import { prisma } from '@documenso/prisma';
import { DocumentStatus, Prisma } from '@documenso/prisma/client';

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

  const [subscriptions, totalCount] = await Promise.all([
    prisma.subscription.findMany({
      where: whereClause,
      include: {
        User: {
          select: {
            name: true,
            email: true,
            Document: {
              where: {
                status: DocumentStatus.COMPLETED,
                deletedAt: null,
                teamId: null,
              },
              select: {
                id: true,
              },
            },
            _count: {
              select: {
                Document: {
                  where: {
                    status: DocumentStatus.COMPLETED,
                    deletedAt: null,
                    teamId: null,
                  },
                },
              },
            },
          },
        },
        team: {
          select: {
            name: true,
            _count: {
              select: {
                document: {
                  where: {
                    status: DocumentStatus.COMPLETED,
                    deletedAt: null,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        ...(sortBy === 'name'
          ? [
              {
                User: {
                  name: sortOrder as Prisma.SortOrder,
                },
              },
              {
                team: {
                  name: sortOrder as Prisma.SortOrder,
                },
              },
              { createdAt: 'desc' as Prisma.SortOrder },
            ]
          : []),
        ...(sortBy === 'createdAt' ? [{ createdAt: sortOrder as Prisma.SortOrder }] : []),
        ...(sortBy === 'signingVolume'
          ? [
              {
                User: {
                  Document: {
                    _count: sortOrder as Prisma.SortOrder,
                  },
                },
              },
              {
                team: {
                  document: {
                    _count: sortOrder as Prisma.SortOrder,
                  },
                },
              },
            ]
          : []),
      ] as Prisma.SubscriptionOrderByWithRelationInput[],
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
    const userSignedDocs = subscription.User?._count?.Document || 0;
    const teamSignedDocs = subscription.team?._count?.document || 0;
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
