import { prisma } from '@documenso/prisma';
import { Prisma } from '@documenso/prisma/client';

export type SigningVolume = {
  id: number;
  name: string;
  signingVolume: number;
  createdAt: Date;
  planId: string;
};

export type GetSigningVolumeOptions = {
  search?: string;
  page?: number;
  perPage?: number;
  sortBy?: 'name' | 'createdAt' | 'signingVolume';
  sortOrder?: 'asc' | 'desc';
};

export async function getSigningVolume({
  search = '',
  page = 1,
  perPage = 10,
  sortBy = 'signingVolume',
  sortOrder = 'desc',
}: GetSigningVolumeOptions) {
  const whereClause = Prisma.validator<Prisma.SubscriptionWhereInput>()({
    status: 'ACTIVE',
    OR: [
      {
        User: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      },
      {
        team: {
          name: { contains: search, mode: 'insensitive' },
        },
      },
    ],
  });

  const orderByClause = getOrderByClause({ sortBy, sortOrder });

  const [subscriptions, totalCount] = await Promise.all([
    prisma.subscription.findMany({
      where: whereClause,
      include: {
        User: {
          include: {
            Document: {
              where: {
                status: 'COMPLETED',
                deletedAt: null,
              },
            },
          },
        },
        team: {
          include: {
            document: {
              where: {
                status: 'COMPLETED',
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: orderByClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
    }),
    prisma.subscription.count({
      where: whereClause,
    }),
  ]);

  const leaderboardWithVolume: SigningVolume[] = subscriptions.map((subscription) => {
    const name =
      subscription.User?.name || subscription.team?.name || subscription.User?.email || 'Unknown';

    const userSignedDocs = subscription.User?.Document?.length || 0;
    const teamSignedDocs = subscription.team?.document?.length || 0;

    return {
      id: subscription.id,
      name,
      signingVolume: userSignedDocs + teamSignedDocs,
      createdAt: subscription.createdAt,
      planId: subscription.planId,
    };
  });

  return {
    leaderboard: leaderboardWithVolume,
    totalPages: Math.ceil(totalCount / perPage),
  };
}

function getOrderByClause(options: {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}): Prisma.SubscriptionOrderByWithRelationInput | Prisma.SubscriptionOrderByWithRelationInput[] {
  const { sortBy, sortOrder } = options;

  if (sortBy === 'name') {
    return [
      {
        User: {
          name: sortOrder,
        },
      },
      {
        team: {
          name: sortOrder,
        },
      },
    ];
  }

  if (sortBy === 'createdAt') {
    return {
      createdAt: sortOrder,
    };
  }

  // Default: sort by signing volume
  return [
    {
      User: {
        Document: {
          _count: sortOrder,
        },
      },
    },
    {
      team: {
        document: {
          _count: sortOrder,
        },
      },
    },
  ];
}
