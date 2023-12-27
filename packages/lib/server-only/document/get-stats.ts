import { prisma } from '@documenso/prisma';
import type { User } from '@documenso/prisma/client';
import type { Prisma } from '@documenso/prisma/client';
import { SigningStatus } from '@documenso/prisma/client';
import { isExtendedDocumentStatus } from '@documenso/prisma/guards/is-extended-document-status';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

type TeamStatsOptions = {
  teamId: number;
  teamEmail?: string;
  senderIds?: number[];
};

export type GetStatsInput = {
  user: User;
  team?: TeamStatsOptions;
};

export const getStats = async ({ user, ...options }: GetStatsInput) => {
  const [ownerCounts, notSignedCounts, hasSignedCounts] = await (options.team
    ? getTeamCounts({ team: options.team })
    : getCounts(user));

  const stats: Record<ExtendedDocumentStatus, number> = {
    [ExtendedDocumentStatus.DRAFT]: 0,
    [ExtendedDocumentStatus.PENDING]: 0,
    [ExtendedDocumentStatus.COMPLETED]: 0,
    [ExtendedDocumentStatus.INBOX]: 0,
    [ExtendedDocumentStatus.ALL]: 0,
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

  Object.keys(stats).forEach((key) => {
    if (key !== ExtendedDocumentStatus.ALL && isExtendedDocumentStatus(key)) {
      stats[ExtendedDocumentStatus.ALL] += stats[key];
    }
  });

  return stats;
};

const getCounts = async (user: User) => {
  return Promise.all([
    prisma.document.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        userId: user.id,
        teamId: null,
        deletedAt: null,
      },
    }),
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
          },
        },
        deletedAt: null,
      },
    }),
    prisma.document.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        OR: [
          {
            status: ExtendedDocumentStatus.PENDING,
            Recipient: {
              some: {
                email: user.email,
                signingStatus: SigningStatus.SIGNED,
              },
            },
            deletedAt: null,
          },
          {
            status: ExtendedDocumentStatus.COMPLETED,
            Recipient: {
              some: {
                email: user.email,
                signingStatus: SigningStatus.SIGNED,
              },
            },
          },
        ],
      },
    }),
  ]);
};

const getTeamCounts = async ({ team }: { team: TeamStatsOptions }) => {
  const { teamId, teamEmail } = team;

  const senderIds = team.senderIds ?? [];

  const userIdWhereClause: Prisma.DocumentWhereInput['userId'] =
    senderIds.length > 0
      ? {
          in: senderIds,
        }
      : undefined;

  let ownerCountsWhereInput: Prisma.DocumentWhereInput = {
    userId: userIdWhereClause,
    teamId,
    deletedAt: null,
  };

  if (teamEmail && senderIds.length === 0) {
    ownerCountsWhereInput = {
      OR: [
        {
          teamId,
        },
        {
          User: {
            email: teamEmail,
          },
        },
      ],
    };
  }

  if (teamEmail && senderIds.length > 0) {
    ownerCountsWhereInput = {
      userId: userIdWhereClause,
      OR: [
        {
          teamId,
        },
        {
          User: {
            email: teamEmail,
          },
        },
      ],
      deletedAt: null,
    };
  }

  let notSignedCountsGroupByArgs = null;

  if (teamEmail) {
    notSignedCountsGroupByArgs = {
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        userId: userIdWhereClause,
        status: ExtendedDocumentStatus.PENDING,
        Recipient: {
          some: {
            email: teamEmail,
            signingStatus: SigningStatus.NOT_SIGNED,
          },
        },
        deletedAt: null,
      },
    } satisfies Prisma.DocumentGroupByArgs;
  }

  let hasSignedCountsGroupByArgs = null;

  if (teamEmail) {
    hasSignedCountsGroupByArgs = {
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        status: ExtendedDocumentStatus.PENDING,
        Recipient: {
          some: {
            email: teamEmail,
            signingStatus: SigningStatus.SIGNED,
          },
        },
        deletedAt: null,
      },
    } satisfies Prisma.DocumentGroupByArgs;
  }

  return Promise.all([
    prisma.document.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: ownerCountsWhereInput,
    }),
    notSignedCountsGroupByArgs ? prisma.document.groupBy(notSignedCountsGroupByArgs) : [],
    hasSignedCountsGroupByArgs ? prisma.document.groupBy(hasSignedCountsGroupByArgs) : [],
  ]);
};
