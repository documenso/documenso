import { prisma } from '@documenso/prisma';
import { Prisma } from '@documenso/prisma/client';

export type SigningVolume = {
  id: number;
  name: string;
  signingVolume: number;
  createdAt: Date;
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

  const orderBy = getOrderByClause({ sortBy, sortOrder });

  const [subscriptions, totalCount] = await Promise.all([
    prisma.subscription.findMany({
      where: whereClause,
      select: {
        id: true,
        createdAt: true,
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            Document: {
              where: {
                status: 'COMPLETED',
                deletedAt: null,
              },
              select: {
                id: true,
              },
            },
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            document: {
              where: {
                status: 'COMPLETED',
                deletedAt: null,
              },
              select: {
                id: true,
              },
            },
          },
        },
      },
      orderBy,
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
    const signingVolume =
      (subscription.User?.Document.length || 0) + (subscription.team?.document.length || 0);

    return {
      id: subscription.id,
      name,
      signingVolume,
      createdAt: subscription.createdAt,
    };
  });

  return {
    leaderboard: leaderboardWithVolume,
    totalPages: Math.ceil(totalCount / perPage),
  };
}

type GetOrderByClauseOptions = {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

const getOrderByClause = ({ sortBy, sortOrder }: GetOrderByClauseOptions) => {
  switch (sortBy) {
    case 'name':
      return [{ User: { name: sortOrder } }, { team: { name: sortOrder } }];
    case 'createdAt':
      return { createdAt: sortOrder };
    default:
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
};
