import { DateTime } from 'luxon';
import { P, match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';
import { RecipientRole, SigningStatus } from '@documenso/prisma/client';
import type { Document, Prisma, Team, TeamEmail, User } from '@documenso/prisma/client';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import type { FindResultSet } from '../../types/find-result-set';
import { maskRecipientTokensForDocument } from '../../utils/mask-recipient-tokens-for-document';

export type PeriodSelectorValue = '' | '7d' | '14d' | '30d';

export type FindDocumentsOptions = {
  userId: number;
  teamId?: number;
  term?: string;
  status?: ExtendedDocumentStatus;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Omit<Document, 'document'>;
    direction: 'asc' | 'desc';
  };
  period?: PeriodSelectorValue;
  senderIds?: number[];
};

export const findDocuments = async ({
  userId,
  teamId,
  term,
  status = ExtendedDocumentStatus.ALL,
  page = 1,
  perPage = 10,
  orderBy,
  period,
  senderIds,
}: FindDocumentsOptions) => {
  const { user, team } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirstOrThrow({
      where: {
        id: userId,
      },
    });

    let team = null;

    if (teamId !== undefined) {
      team = await tx.team.findFirstOrThrow({
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
        },
      });
    }

    return {
      user,
      team,
    };
  });

  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';

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

  const filters = team ? findTeamDocumentsFilter(status, team) : findDocumentsFilter(status, user);

  if (filters === null) {
    return {
      data: [],
      count: 0,
      currentPage: 1,
      perPage,
      totalPages: 0,
    };
  }

  const whereClause: Prisma.DocumentWhereInput = {
    ...termFilters,
    ...filters,
    AND: {
      OR: [
        {
          status: ExtendedDocumentStatus.COMPLETED,
        },
        {
          status: {
            not: ExtendedDocumentStatus.COMPLETED,
          },
          deletedAt: null,
        },
      ],
    },
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
) => {
  const teamEmail = team.teamEmail?.email ?? null;

  return match<ExtendedDocumentStatus, Prisma.DocumentWhereInput | null>(status)
    .with(ExtendedDocumentStatus.ALL, () => {
      const filter: Prisma.DocumentWhereInput = {
        // Filter to display all documents that belong to the team.
        OR: [
          {
            teamId: team.id,
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
        });

        // Filter to display all documents that have been sent by the team email.
        filter.OR.push({
          User: {
            email: teamEmail,
          },
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
      };
    })
    .with(ExtendedDocumentStatus.DRAFT, () => {
      const filter: Prisma.DocumentWhereInput = {
        OR: [
          {
            teamId: team.id,
            status: ExtendedDocumentStatus.DRAFT,
          },
        ],
      };

      if (teamEmail && filter.OR) {
        filter.OR.push({
          status: ExtendedDocumentStatus.DRAFT,
          User: {
            email: teamEmail,
          },
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
            },
            {
              User: {
                email: teamEmail,
              },
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
          },
          {
            User: {
              email: teamEmail,
            },
          },
        );
      }

      return filter;
    })
    .exhaustive();
};
