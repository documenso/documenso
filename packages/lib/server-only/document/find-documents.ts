import { DateTime } from 'luxon';
import { P, match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';
import { RecipientRole, SigningStatus, TeamMemberRole } from '@documenso/prisma/client';
import type {
  Document,
  DocumentSource,
  Prisma,
  Team,
  TeamEmail,
  User,
} from '@documenso/prisma/client';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import { DocumentVisibility } from '../../types/document-visibility';
import type { FindResultSet } from '../../types/find-result-set';
import { maskRecipientTokensForDocument } from '../../utils/mask-recipient-tokens-for-document';

export type PeriodSelectorValue = '' | '7d' | '14d' | '30d';

export type FindDocumentsOptions = {
  userId: number;
  teamId?: number;
  term?: string;
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
  search?: string;
};

export const findDocuments = async ({
  userId,
  teamId,
  term,
  templateId,
  source,
  status = ExtendedDocumentStatus.ALL,
  page = 1,
  perPage = 10,
  orderBy,
  period,
  senderIds,
  search,
}: FindDocumentsOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  let team = null;

  if (teamId !== undefined) {
    team = await prisma.team.findFirstOrThrow({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        teamEmail: true,
        members: {
          where: {
            userId,
          },
          select: {
            role: true,
          },
        },
      },
    });
  }

  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';
  const teamMemberRole = team?.members[0].role ?? null;

  const termFilters = match(term)
    .with(P.string.minLength(1), () => {
      return {
        title: {
          contains: term,
          mode: 'insensitive',
        },
      } as const;
    })
    .otherwise(() => undefined);

  const searchFilter: Prisma.DocumentWhereInput = {
    OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { Recipient: { some: { name: { contains: search, mode: 'insensitive' } } } },
      { Recipient: { some: { email: { contains: search, mode: 'insensitive' } } } },
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
      Recipient: {
        some: {
          email: user.email,
        },
      },
    },
  ];

  let filters: Prisma.DocumentWhereInput | null = findDocumentsFilter(status, user);

  if (team) {
    filters = findTeamDocumentsFilter(status, team, visibilityFilters);
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
          Recipient: {
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
                User: {
                  email: team.teamEmail.email,
                },
                deletedAt: null,
              },
              {
                Recipient: {
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
    { ...termFilters },
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

  const [data, count] = await Promise.all([
    prisma.document.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Recipient: true,
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
  } satisfies FindResultSet<typeof data>;
};

const findDocumentsFilter = (status: ExtendedDocumentStatus, user: User) => {
  return match<ExtendedDocumentStatus, Prisma.DocumentWhereInput>(status)
    .with(ExtendedDocumentStatus.ALL, () => ({
      OR: [
        {
          userId: user.id,
          teamId: null,
        },
        {
          status: ExtendedDocumentStatus.COMPLETED,
          Recipient: {
            some: {
              email: user.email,
            },
          },
        },
        {
          status: ExtendedDocumentStatus.PENDING,
          Recipient: {
            some: {
              email: user.email,
            },
          },
        },
      ],
    }))
    .with(ExtendedDocumentStatus.INBOX, () => ({
      status: {
        not: ExtendedDocumentStatus.DRAFT,
      },
      Recipient: {
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
      teamId: null,
      status: ExtendedDocumentStatus.DRAFT,
    }))
    .with(ExtendedDocumentStatus.PENDING, () => ({
      OR: [
        {
          userId: user.id,
          teamId: null,
          status: ExtendedDocumentStatus.PENDING,
        },
        {
          status: ExtendedDocumentStatus.PENDING,
          Recipient: {
            some: {
              email: user.email,
              signingStatus: SigningStatus.SIGNED,
              role: {
                not: RecipientRole.CC,
              },
            },
          },
        },
      ],
    }))
    .with(ExtendedDocumentStatus.COMPLETED, () => ({
      OR: [
        {
          userId: user.id,
          teamId: null,
          status: ExtendedDocumentStatus.COMPLETED,
        },
        {
          status: ExtendedDocumentStatus.COMPLETED,
          Recipient: {
            some: {
              email: user.email,
            },
          },
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
) => {
  const teamEmail = team.teamEmail?.email ?? null;

  return match<ExtendedDocumentStatus, Prisma.DocumentWhereInput | null>(status)
    .with(ExtendedDocumentStatus.ALL, () => {
      const filter: Prisma.DocumentWhereInput = {
        // Filter to display all documents that belong to the team.
        OR: [
          {
            teamId: team.id,
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
          Recipient: {
            some: {
              email: teamEmail,
            },
          },
          OR: visibilityFilters,
        });

        // Filter to display all documents that have been sent by the team email.
        filter.OR.push({
          User: {
            email: teamEmail,
          },
          OR: visibilityFilters,
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
        Recipient: {
          some: {
            email: teamEmail,
            signingStatus: SigningStatus.NOT_SIGNED,
            role: {
              not: RecipientRole.CC,
            },
          },
        },
        OR: visibilityFilters,
      };
    })
    .with(ExtendedDocumentStatus.DRAFT, () => {
      const filter: Prisma.DocumentWhereInput = {
        OR: [
          {
            teamId: team.id,
            status: ExtendedDocumentStatus.DRAFT,
            OR: visibilityFilters,
          },
        ],
      };

      if (teamEmail && filter.OR) {
        filter.OR.push({
          status: ExtendedDocumentStatus.DRAFT,
          User: {
            email: teamEmail,
          },
          OR: visibilityFilters,
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
          },
        ],
      };

      if (teamEmail && filter.OR) {
        filter.OR.push({
          status: ExtendedDocumentStatus.PENDING,
          OR: [
            {
              Recipient: {
                some: {
                  email: teamEmail,
                  signingStatus: SigningStatus.SIGNED,
                  role: {
                    not: RecipientRole.CC,
                  },
                },
              },
              OR: visibilityFilters,
            },
            {
              User: {
                email: teamEmail,
              },
              OR: visibilityFilters,
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
            Recipient: {
              some: {
                email: teamEmail,
              },
            },
            OR: visibilityFilters,
          },
          {
            User: {
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
