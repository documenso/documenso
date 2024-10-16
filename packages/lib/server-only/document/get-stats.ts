import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import type { PeriodSelectorValue } from '@documenso/lib/server-only/document/find-documents';
import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';
import type { Prisma, User } from '@documenso/prisma/client';
import { SigningStatus } from '@documenso/prisma/client';
import { isExtendedDocumentStatus } from '@documenso/prisma/guards/is-extended-document-status';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import { DocumentVisibility } from '../../types/document-visibility';

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
        userId: user.id,
        createdAt,
        teamId: null,
        deletedAt: null,
        AND: [searchFilter],
      },
    }),
    // Not signed counts.
    prisma.document.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        status: ExtendedDocumentStatus.PENDING,
        Recipient: {
          some: {
            email: user.email,
            signingStatus: SigningStatus.NOT_SIGNED,
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
        createdAt,
        User: {
          email: {
            not: user.email,
          },
        },
        OR: [
          {
            status: ExtendedDocumentStatus.PENDING,
            Recipient: {
              some: {
                email: user.email,
                signingStatus: SigningStatus.SIGNED,
                documentDeletedAt: null,
              },
            },
          },
          {
            status: ExtendedDocumentStatus.COMPLETED,
            Recipient: {
              some: {
                email: user.email,
                signingStatus: SigningStatus.SIGNED,
                documentDeletedAt: null,
              },
            },
          },
        ],
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
                signingStatus: SigningStatus.SIGNED,
                documentDeletedAt: {
                  gte: DateTime.now().minus({ days: 30 }).startOf('day').toJSDate(),
                },
              },
            },
          },
        ],
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
  const {
    createdAt,
    teamId,
    teamEmail,
    senderIds = [],
    currentUserEmail,
    currentTeamMemberRole,
    search,
  } = options;

  const userIdWhereClause: Prisma.DocumentWhereInput['userId'] =
    senderIds.length > 0
      ? {
          in: senderIds,
        }
      : undefined;

  const searchFilter: Prisma.DocumentWhereInput = {
    OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { Recipient: { some: { name: { contains: search, mode: 'insensitive' } } } },
      { Recipient: { some: { email: { contains: search, mode: 'insensitive' } } } },
    ],
  };

  const visibilityFilters = [
    ...match(currentTeamMemberRole)
      .with(TeamMemberRole.ADMIN, () => [
        { visibility: DocumentVisibility.EVERYONE },
        { visibility: DocumentVisibility.MANAGER_AND_ABOVE },
        { visibility: DocumentVisibility.ADMIN },
      ])
      .with(TeamMemberRole.MANAGER, () => [
        { visibility: DocumentVisibility.EVERYONE },
        { visibility: DocumentVisibility.MANAGER_AND_ABOVE },
      ])
      .otherwise(() => [{ visibility: DocumentVisibility.EVERYONE }]),
  ];

  const ownerCountsWhereInput: Prisma.DocumentWhereInput = {
    userId: userIdWhereClause,
    createdAt,
    OR: [
      { teamId },
      ...(teamEmail ? [{ User: { email: teamEmail } }] : []),
      {
        AND: [
          {
            visibility: {
              in: visibilityFilters.map((filter) => filter.visibility),
            },
          },
          {
            Recipient: {
              none: {
                email: currentUserEmail,
              },
            },
          },
        ],
      },
      {
        Recipient: {
          some: {
            email: currentUserEmail,
          },
        },
      },
    ],
    deletedAt: null,
    ...searchFilter,
  };

  const notSignedCountsWhereInput: Prisma.DocumentWhereInput = {
    userId: userIdWhereClause,
    createdAt,
    status: ExtendedDocumentStatus.PENDING,
    OR: [
      { teamId },
      ...(teamEmail
        ? [
            {
              Recipient: {
                some: {
                  email: teamEmail,
                  signingStatus: SigningStatus.NOT_SIGNED,
                  documentDeletedAt: null,
                },
              },
            },
          ]
        : []),
    ],
    deletedAt: null,
  };

  const hasSignedCountsWhereInput: Prisma.DocumentWhereInput = {
    userId: userIdWhereClause,
    createdAt,
    OR: [
      {
        teamId,
        status: {
          in: [ExtendedDocumentStatus.PENDING, ExtendedDocumentStatus.COMPLETED],
        },
      },
      ...(teamEmail
        ? [
            {
              Recipient: {
                some: {
                  email: teamEmail,
                  signingStatus: SigningStatus.SIGNED,
                  documentDeletedAt: null,
                },
              },
              status: {
                in: [ExtendedDocumentStatus.PENDING, ExtendedDocumentStatus.COMPLETED],
              },
            },
          ]
        : []),
    ],
    deletedAt: null,
  };

  const deletedCountsWhereInput: Prisma.DocumentWhereInput = {
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
  };

  return Promise.all([
    prisma.document.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: ownerCountsWhereInput,
    }),
    prisma.document.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: notSignedCountsWhereInput,
    }),
    prisma.document.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: hasSignedCountsWhereInput,
    }),
    prisma.document.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: deletedCountsWhereInput,
    }),
  ]);
};
