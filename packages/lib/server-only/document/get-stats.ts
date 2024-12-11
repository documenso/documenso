import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

// eslint-disable-next-line import/no-extraneous-dependencies
import type { PeriodSelectorValue } from '@documenso/lib/server-only/document/find-documents';
import { prisma } from '@documenso/prisma';
import type { Prisma, User } from '@documenso/prisma/client';
import {
  DocumentVisibility,
  RecipientRole,
  SigningStatus,
  TeamMemberRole,
} from '@documenso/prisma/client';
import { isExtendedDocumentStatus } from '@documenso/prisma/guards/is-extended-document-status';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

export type GetStatsInput = {
  user: User;
  team?: Omit<GetTeamCountsOption, 'createdAt'>;
  period?: PeriodSelectorValue;
  search?: string;
};

export const getStats = async ({ user, period, search, ...options }: GetStatsInput) => {
  let createdAt: Prisma.DocumentWhereInput['createdAt'];

  if (period) {
    const daysAgo = parseInt(period.replace(/d$/, ''), 10);

    const startOfPeriod = DateTime.now().minus({ days: daysAgo }).startOf('day');

    createdAt = {
      gte: startOfPeriod.toJSDate(),
    };
  }

  const [ownerCounts, notSignedCounts, hasSignedCounts, deletedCounts] = await (options.team
    ? getTeamCounts({
        ...options.team,
        createdAt,
        currentUserEmail: user.email,
        userId: user.id,
        search,
      })
    : getCounts({ user, createdAt, search }));

  const stats: Record<ExtendedDocumentStatus, number> = {
    [ExtendedDocumentStatus.DRAFT]: 0,
    [ExtendedDocumentStatus.PENDING]: 0,
    [ExtendedDocumentStatus.COMPLETED]: 0,
    [ExtendedDocumentStatus.INBOX]: 0,
    [ExtendedDocumentStatus.ALL]: 0,
    [ExtendedDocumentStatus.BIN]: 0,
  };

  ownerCounts.forEach((stat) => {
    stats[stat.status] = stat._count._all;
  });

  notSignedCounts.forEach((stat) => {
    stats[ExtendedDocumentStatus.INBOX] += stat._count._all;
  });

  hasSignedCounts.forEach((stat) => {
    if (stat.status === ExtendedDocumentStatus.COMPLETED) {
      stats[ExtendedDocumentStatus.COMPLETED] += stat._count._all;
    }

    if (stat.status === ExtendedDocumentStatus.PENDING) {
      stats[ExtendedDocumentStatus.PENDING] += stat._count._all;
    }
  });

  deletedCounts.forEach((stat) => {
    stats[ExtendedDocumentStatus.BIN] += stat._count._all;
  });

  Object.keys(stats).forEach((key) => {
    if (key !== ExtendedDocumentStatus.ALL && isExtendedDocumentStatus(key)) {
      stats[ExtendedDocumentStatus.ALL] += stats[key];
    }
  });

  return stats;
};

type GetCountsOption = {
  user: User;
  createdAt: Prisma.DocumentWhereInput['createdAt'];
  search?: string;
};

const getCounts = async ({ user, createdAt, search }: GetCountsOption) => {
  const searchFilter: Prisma.DocumentWhereInput = {
    OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { Recipient: { some: { name: { contains: search, mode: 'insensitive' } } } },
      { Recipient: { some: { email: { contains: search, mode: 'insensitive' } } } },
    ],
  };

  return Promise.all([
    // Owner counts.
    prisma.document.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        OR: [
          {
            userId: user.id,
            teamId: null,
            deletedAt: null,
          },
          {
            status: {
              not: ExtendedDocumentStatus.DRAFT,
            },
            Recipient: {
              some: {
                email: user.email,
                documentDeletedAt: null,
              },
            },
          },
        ],
        createdAt,
        AND: [searchFilter],
      },
    }),
    // Not signed counts (Inbox).
    prisma.document.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
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
            documentDeletedAt: null,
          },
        },
        createdAt,
        AND: [searchFilter],
      },
    }),
    // Has signed counts.
    prisma.document.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        OR: [
          {
            userId: user.id,
            teamId: null,
            status: ExtendedDocumentStatus.PENDING,
            deletedAt: null,
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
                documentDeletedAt: null,
              },
            },
          },
          {
            userId: user.id,
            teamId: null,
            status: ExtendedDocumentStatus.COMPLETED,
            deletedAt: null,
          },
          {
            status: ExtendedDocumentStatus.COMPLETED,
            Recipient: {
              some: {
                email: user.email,
                documentDeletedAt: null,
              },
            },
          },
        ],
        createdAt,
        AND: [searchFilter],
      },
    }),
    // Deleted counts.
    prisma.document.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        OR: [
          {
            userId: user.id,
            teamId: null,
            deletedAt: {
              gte: DateTime.now().minus({ days: 30 }).startOf('day').toJSDate(),
            },
          },
          {
            status: ExtendedDocumentStatus.PENDING,
            Recipient: {
              some: {
                email: user.email,
                signingStatus: SigningStatus.SIGNED,
                documentDeletedAt: {
                  gte: DateTime.now().minus({ days: 30 }).startOf('day').toJSDate(),
                },
              },
            },
          },
          {
            status: ExtendedDocumentStatus.COMPLETED,
            Recipient: {
              some: {
                email: user.email,
                documentDeletedAt: {
                  gte: DateTime.now().minus({ days: 30 }).startOf('day').toJSDate(),
                },
              },
            },
          },
        ],
        AND: [searchFilter],
      },
    }),
  ]);
};

type GetTeamCountsOption = {
  teamId: number;
  teamEmail?: string;
  senderIds?: number[];
  currentUserEmail: string;
  userId: number;
  createdAt: Prisma.DocumentWhereInput['createdAt'];
  currentTeamMemberRole?: TeamMemberRole;
  search?: string;
};

const getTeamCounts = async (options: GetTeamCountsOption) => {
  const { createdAt, teamId, teamEmail, senderIds = [], currentTeamMemberRole, search } = options;

  const userIdWhereClause: Prisma.DocumentWhereInput['userId'] =
    senderIds.length > 0
      ? {
          in: senderIds,
        }
      : undefined;

  const searchFilter: Prisma.DocumentWhereInput = search
    ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { Recipient: { some: { name: { contains: search, mode: 'insensitive' } } } },
          { Recipient: { some: { email: { contains: search, mode: 'insensitive' } } } },
        ],
      }
    : {};

  const visibilityFilters = [
    match(currentTeamMemberRole)
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
  ];

  return Promise.all([
    // Owner counts (ALL)
    prisma.document.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: {
        OR: [
          {
            teamId,
            deletedAt: null,
            OR: visibilityFilters,
          },
          ...(teamEmail
            ? [
                {
                  status: {
                    not: ExtendedDocumentStatus.DRAFT,
                  },
                  Recipient: {
                    some: {
                      email: teamEmail,
                      documentDeletedAt: null,
                    },
                  },
                  deletedAt: null,
                  OR: visibilityFilters,
                },
                {
                  User: {
                    email: teamEmail,
                  },
                  deletedAt: null,
                  OR: visibilityFilters,
                },
              ]
            : []),
        ],
        userId: userIdWhereClause,
        createdAt,
        ...searchFilter,
      },
    }),

    // Not signed counts (INBOX)
    prisma.document.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: teamEmail
        ? {
            userId: userIdWhereClause,
            createdAt,
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
            deletedAt: null,
            OR: visibilityFilters,
            ...searchFilter,
          }
        : {
            userId: userIdWhereClause,
            createdAt,
            AND: [
              {
                OR: [{ id: -1 }], // Empty set if no team email
              },
              searchFilter,
            ],
          },
    }),

    // Has signed counts (PENDING + COMPLETED)
    prisma.document.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: {
        userId: userIdWhereClause,
        createdAt,
        OR: [
          {
            teamId,
            status: ExtendedDocumentStatus.PENDING,
            deletedAt: null,
            OR: visibilityFilters,
          },
          {
            teamId,
            status: ExtendedDocumentStatus.COMPLETED,
            deletedAt: null,
            OR: visibilityFilters,
          },
          ...(teamEmail
            ? [
                {
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
                          documentDeletedAt: null,
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
                  deletedAt: null,
                },
                {
                  status: ExtendedDocumentStatus.COMPLETED,
                  OR: [
                    {
                      Recipient: {
                        some: {
                          email: teamEmail,
                          documentDeletedAt: null,
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
                  deletedAt: null,
                },
              ]
            : []),
        ],
        ...searchFilter,
      },
    }),

    // Deleted counts (BIN)
    prisma.document.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: {
        OR: [
          {
            teamId,
            deletedAt: {
              gte: DateTime.now().minus({ days: 30 }).startOf('day').toJSDate(),
            },
          },
          ...(teamEmail
            ? [
                {
                  User: {
                    email: teamEmail,
                  },
                  deletedAt: {
                    gte: DateTime.now().minus({ days: 30 }).startOf('day').toJSDate(),
                  },
                },
                {
                  Recipient: {
                    some: {
                      email: teamEmail,
                      documentDeletedAt: {
                        gte: DateTime.now().minus({ days: 30 }).startOf('day').toJSDate(),
                      },
                    },
                  },
                },
              ]
            : []),
        ],
        ...searchFilter,
      },
    }),
  ]);
};
