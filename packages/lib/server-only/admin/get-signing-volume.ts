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
            },
          },
        },
        team: {
          select: {
            name: true,
            document: {
              where: {
                status: DocumentStatus.COMPLETED,
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy:
        sortBy === 'name'
          ? [{ User: { name: sortOrder } }, { team: { name: sortOrder } }, { createdAt: 'desc' }]
          : sortBy === 'createdAt'
            ? [{ createdAt: sortOrder }]
            : undefined,
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

  if (sortBy === 'signingVolume') {
    leaderboardWithVolume.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.signingVolume - a.signingVolume
        : a.signingVolume - b.signingVolume;
    });
  }

  return {
    leaderboard: leaderboardWithVolume,
    totalPages: Math.ceil(totalCount / perPage),
  };
}
