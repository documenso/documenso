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

  const subscriptionsWithVolume = await prisma.subscription.findMany({
    where: whereClause,
    select: {
      id: true,
      createdAt: true,
      planId: true,
      User: {
        select: {
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
          teamMembers: {
            select: {
              team: {
                select: {
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
          },
        },
      },
      team: {
        select: {
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
  });

  const totalCount = await prisma.subscription.count({
    where: whereClause,
  });

  const leaderboard = subscriptionsWithVolume.map((subscription): SigningVolume => {
    const name =
      subscription.User?.name || subscription.team?.name || subscription.User?.email || 'Unknown';

    const personalDocs = subscription.User?.Document?.length ?? 0;
    const teamDocs = subscription.team?.document?.length ?? 0;
    const teamMemberDocs = (subscription.User?.teamMembers ?? []).reduce(
      (acc, member) => acc + (member.team.document?.length ?? 0),
      0,
    );

    return {
      id: subscription.id,
      name,
      signingVolume: personalDocs + teamDocs + teamMemberDocs,
      createdAt: subscription.createdAt,
      planId: subscription.planId,
    };
  });

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    if (sortBy === 'name') {
      return sortOrder === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
    }

    if (sortBy === 'createdAt') {
      return sortOrder === 'desc'
        ? b.createdAt.getTime() - a.createdAt.getTime()
        : a.createdAt.getTime() - b.createdAt.getTime();
    }

    return sortOrder === 'desc'
      ? b.signingVolume - a.signingVolume
      : a.signingVolume - b.signingVolume;
  });

  const paginatedLeaderboard = sortedLeaderboard.slice((page - 1) * perPage, page * perPage);

  return {
    leaderboard: paginatedLeaderboard,
    totalPages: Math.ceil(totalCount / perPage),
  };
}
