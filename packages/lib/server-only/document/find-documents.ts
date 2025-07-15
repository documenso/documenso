import type { Document, DocumentSource, Prisma, Team, TeamEmail, User } from '@prisma/client';
import { RecipientRole, SigningStatus, TeamMemberRole } from '@prisma/client';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import { DocumentVisibility } from '../../types/document-visibility';
import { type FindResultResponse } from '../../types/search-params';
import { maskRecipientTokensForDocument } from '../../utils/mask-recipient-tokens-for-document';
import { getTeamById } from '../team/get-team';

export type PeriodSelectorValue = '' | '7d' | '14d' | '30d';

export type FindDocumentsOptions = {
  userId: number;
  teamId?: number;
  templateId?: number;
  source?: DocumentSource;
  status?: ExtendedDocumentStatus;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Omit<Document, 'document'>;
    direction: 'asc' | 'desc';
  };
  period?: PeriodSelectorValue;
  senderIds?: number[];
  query?: string;
  folderId?: string;
};

export const findDocuments = async ({
  userId,
  teamId,
  templateId,
  source,
  status = ExtendedDocumentStatus.ALL,
  page = 1,
  perPage = 10,
  orderBy,
  period,
  senderIds,
  query = '',
  folderId,
}: FindDocumentsOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  let team = null;

  if (teamId !== undefined) {
    team = await getTeamById({
      userId,
      teamId,
    });
  }

  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';
  const teamMemberRole = team?.currentTeamRole ?? null;

  const searchFilter: Prisma.DocumentWhereInput = {
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { externalId: { contains: query, mode: 'insensitive' } },
      { recipients: { some: { name: { contains: query, mode: 'insensitive' } } } },
      { recipients: { some: { email: { contains: query, mode: 'insensitive' } } } },
    ],
  };

  const visibilityFilters = [
    match(teamMemberRole)
      .with(TeamMemberRole.ADMIN, () => ({
        visibility: {
          in: [
            DocumentVisibility.EVERYONE,
            DocumentVisibility.MANAGER_AND_ABOVE,
            DocumentVisibility.ADMIN,
          ],
        },
      }))
      .with(TeamMemberRole.MANAGER, () => ({
        visibility: {
          in: [DocumentVisibility.EVERYONE, DocumentVisibility.MANAGER_AND_ABOVE],
        },
      }))
      .otherwise(() => ({ visibility: DocumentVisibility.EVERYONE })),
    {
      OR: [
        {
          recipients: {
            some: {
              email: user.email,
            },
          },
        },
        {
          userId: user.id,
        },
      ],
    },
  ];

  let filters: Prisma.DocumentWhereInput | null = findDocumentsFilter(status, user, folderId);

  if (team) {
    filters = findTeamDocumentsFilter(status, team, visibilityFilters, folderId);
  }

  if (filters === null) {
    return {
      data: [],
      count: 0,
      currentPage: 1,
      perPage,
      totalPages: 0,
    };
  }

  let deletedFilter: Prisma.DocumentWhereInput = {
    AND: {
      OR: [
        {
          userId: user.id,
          deletedAt: null,
        },
        {
          recipients: {
            some: {
              email: user.email,
              documentDeletedAt: null,
            },
          },
        },
      ],
    },
  };

  if (team) {
    deletedFilter = {
      AND: {
        OR: team.teamEmail
          ? [
              {
                teamId: team.id,
                deletedAt: null,
              },
              {
                user: {
                  email: team.teamEmail.email,
                },
                deletedAt: null,
              },
              {
                recipients: {
                  some: {
                    email: team.teamEmail.email,
                    documentDeletedAt: null,
                  },
                },
              },
            ]
          : [
              {
                teamId: team.id,
                deletedAt: null,
              },
            ],
      },
    };
  }

  const whereAndClause: Prisma.DocumentWhereInput['AND'] = [
    { ...filters },
    { ...deletedFilter },
    { ...searchFilter },
  ];

  if (templateId) {
    whereAndClause.push({
      templateId,
    });
  }

  if (source) {
    whereAndClause.push({
      source,
    });
  }

  const whereClause: Prisma.DocumentWhereInput = {
    AND: whereAndClause,
  };

  if (period) {
    const daysAgo = parseInt(period.replace(/d$/, ''), 10);

    const startOfPeriod = DateTime.now().minus({ days: daysAgo }).startOf('day');

    whereClause.createdAt = {
      gte: startOfPeriod.toJSDate(),
    };
  }

  if (senderIds && senderIds.length > 0) {
    whereClause.userId = {
      in: senderIds,
    };
  }

  if (folderId !== undefined) {
    whereClause.folderId = folderId;
  } else {
    whereClause.folderId = null;
  }

  const [data, count] = await Promise.all([
    prisma.document.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipients: true,
        team: {
          select: {
            id: true,
            url: true,
          },
        },
      },
    }),
    prisma.document.count({
      where: whereClause,
    }),
  ]);

  const maskedData = data.map((document) =>
    maskRecipientTokensForDocument({
      document,
      user,
    }),
  );

  return {
    data: maskedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};

const findDocumentsFilter = (
  status: ExtendedDocumentStatus,
  user: User,
  folderId?: string | null,
) => {
  return match<ExtendedDocumentStatus, Prisma.DocumentWhereInput>(status)
    .with(ExtendedDocumentStatus.ALL, () => ({
      OR: [
        {
          userId: user.id,
          folderId: folderId,
        },
        {
          status: ExtendedDocumentStatus.COMPLETED,
          recipients: {
            some: {
              email: user.email,
            },
          },
          folderId: folderId,
        },
        {
          status: ExtendedDocumentStatus.PENDING,
          recipients: {
            some: {
              email: user.email,
            },
          },
          folderId: folderId,
        },
      ],
    }))
    .with(ExtendedDocumentStatus.INBOX, () => ({
      status: {
        not: ExtendedDocumentStatus.DRAFT,
      },
      recipients: {
        some: {
          email: user.email,
          signingStatus: SigningStatus.NOT_SIGNED,
          role: {
            not: RecipientRole.CC,
          },
        },
      },
    }))
    .with(ExtendedDocumentStatus.DRAFT, () => ({
      userId: user.id,
      status: ExtendedDocumentStatus.DRAFT,
    }))
    .with(ExtendedDocumentStatus.PENDING, () => ({
      OR: [
        {
          userId: user.id,
          status: ExtendedDocumentStatus.PENDING,
          folderId: folderId,
        },
        {
          status: ExtendedDocumentStatus.PENDING,
          recipients: {
            some: {
              email: user.email,
              signingStatus: SigningStatus.SIGNED,
              role: {
                not: RecipientRole.CC,
              },
            },
          },
          folderId: folderId,
        },
      ],
    }))
    .with(ExtendedDocumentStatus.COMPLETED, () => ({
      OR: [
        {
          userId: user.id,
          status: ExtendedDocumentStatus.COMPLETED,
          folderId: folderId,
        },
        {
          status: ExtendedDocumentStatus.COMPLETED,
          recipients: {
            some: {
              email: user.email,
            },
          },
          folderId: folderId,
        },
      ],
    }))
    .with(ExtendedDocumentStatus.REJECTED, () => ({
      OR: [
        {
          userId: user.id,
          status: ExtendedDocumentStatus.REJECTED,
          folderId: folderId,
        },
        {
          status: ExtendedDocumentStatus.REJECTED,
          recipients: {
            some: {
              email: user.email,
              signingStatus: SigningStatus.REJECTED,
            },
          },
          folderId: folderId,
        },
      ],
    }))
    .exhaustive();
};

/**
 * Create a Prisma filter for the Document schema to find documents for a team.
 *
 * Status All:
 *  - Documents that belong to the team
 *  - Documents that have been sent by the team email
 *  - Non draft documents that have been sent to the team email
 *
 * Status Inbox:
 *  - Non draft documents that have been sent to the team email that have not been signed
 *
 * Status Draft:
 * - Documents that belong to the team that are draft
 * - Documents that belong to the team email that are draft
 *
 * Status Pending:
 * - Documents that belong to the team that are pending
 * - Documents that have been sent by the team email that is pending to be signed by someone else
 * - Documents that have been sent to the team email that is pending to be signed by someone else
 *
 * Status Completed:
 * - Documents that belong to the team that are completed
 * - Documents that have been sent to the team email that are completed
 * - Documents that have been sent by the team email that are completed
 *
 * @param status The status of the documents to find.
 * @param team The team to find the documents for.
 * @returns A filter which can be applied to the Prisma Document schema.
 */
const findTeamDocumentsFilter = (
  status: ExtendedDocumentStatus,
  team: Team & { teamEmail: TeamEmail | null },
  visibilityFilters: Prisma.DocumentWhereInput[],
  folderId?: string,
) => {
  const teamEmail = team.teamEmail?.email ?? null;

  return match<ExtendedDocumentStatus, Prisma.DocumentWhereInput | null>(status)
    .with(ExtendedDocumentStatus.ALL, () => {
      const filter: Prisma.DocumentWhereInput = {
        // Filter to display all documents that belong to the team.
        OR: [
          {
            teamId: team.id,
            folderId: folderId,
            OR: visibilityFilters,
          },
        ],
      };

      if (teamEmail && filter.OR) {
        // Filter to display all documents received by the team email that are not draft.
        filter.OR.push({
          status: {
            not: ExtendedDocumentStatus.DRAFT,
          },
          recipients: {
            some: {
              email: teamEmail,
            },
          },
          OR: visibilityFilters,
          folderId: folderId,
        });

        // Filter to display all documents that have been sent by the team email.
        filter.OR.push({
          user: {
            email: teamEmail,
          },
          OR: visibilityFilters,
          folderId: folderId,
        });
      }

      return filter;
    })
    .with(ExtendedDocumentStatus.INBOX, () => {
      // Return a filter that will return nothing.
      if (!teamEmail) {
        return null;
      }

      return {
        status: {
          not: ExtendedDocumentStatus.DRAFT,
        },
        recipients: {
          some: {
            email: teamEmail,
            signingStatus: SigningStatus.NOT_SIGNED,
            role: {
              not: RecipientRole.CC,
            },
          },
        },
        OR: visibilityFilters,
        folderId: folderId,
      };
    })
    .with(ExtendedDocumentStatus.DRAFT, () => {
      const filter: Prisma.DocumentWhereInput = {
        OR: [
          {
            teamId: team.id,
            status: ExtendedDocumentStatus.DRAFT,
            OR: visibilityFilters,
            folderId: folderId,
          },
        ],
      };

      if (teamEmail && filter.OR) {
        filter.OR.push({
          status: ExtendedDocumentStatus.DRAFT,
          user: {
            email: teamEmail,
          },
          OR: visibilityFilters,
          folderId: folderId,
        });
      }

      return filter;
    })
    .with(ExtendedDocumentStatus.PENDING, () => {
      const filter: Prisma.DocumentWhereInput = {
        OR: [
          {
            teamId: team.id,
            status: ExtendedDocumentStatus.PENDING,
            OR: visibilityFilters,
            folderId: folderId,
          },
        ],
      };

      if (teamEmail && filter.OR) {
        filter.OR.push({
          status: ExtendedDocumentStatus.PENDING,
          OR: [
            {
              recipients: {
                some: {
                  email: teamEmail,
                  signingStatus: SigningStatus.SIGNED,
                  role: {
                    not: RecipientRole.CC,
                  },
                },
              },
              OR: visibilityFilters,
              folderId: folderId,
            },
            {
              user: {
                email: teamEmail,
              },
              OR: visibilityFilters,
              folderId: folderId,
            },
          ],
        });
      }

      return filter;
    })
    .with(ExtendedDocumentStatus.COMPLETED, () => {
      const filter: Prisma.DocumentWhereInput = {
        status: ExtendedDocumentStatus.COMPLETED,
        OR: [
          {
            teamId: team.id,
            OR: visibilityFilters,
          },
        ],
      };

      if (teamEmail && filter.OR) {
        filter.OR.push(
          {
            recipients: {
              some: {
                email: teamEmail,
              },
            },
            OR: visibilityFilters,
          },
          {
            user: {
              email: teamEmail,
            },
            OR: visibilityFilters,
          },
        );
      }

      return filter;
    })
    .with(ExtendedDocumentStatus.REJECTED, () => {
      const filter: Prisma.DocumentWhereInput = {
        status: ExtendedDocumentStatus.REJECTED,
        OR: [
          {
            teamId: team.id,
            OR: visibilityFilters,
          },
        ],
      };

      if (teamEmail && filter.OR) {
        filter.OR.push(
          {
            recipients: {
              some: {
                email: teamEmail,
                signingStatus: SigningStatus.REJECTED,
              },
            },
            OR: visibilityFilters,
          },
          {
            user: {
              email: teamEmail,
            },
            OR: visibilityFilters,
          },
        );
      }

      return filter;
    })
    .exhaustive();
};
