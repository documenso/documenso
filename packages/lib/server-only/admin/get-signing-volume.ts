import { prisma } from '@documenso/prisma';
import { DocumentStatus, SubscriptionStatus } from '@documenso/prisma/client';

type GetSigningVolumeOptions = {
  search?: string;
  page?: number;
  perPage?: number;
  sortBy?: 'name' | 'createdAt' | 'signingVolume';
  sortOrder?: 'asc' | 'desc';
};

export const getSigningVolume = async ({
  search = '',
  page = 1,
  perPage = 10,
  sortBy = 'signingVolume',
  sortOrder = 'desc',
}: GetSigningVolumeOptions) => {
  const validPage = Math.max(1, page);
  const validPerPage = Math.max(1, perPage);
  const skip = (validPage - 1) * validPerPage;

  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
    },
    select: {
      id: true,
      planId: true,
      userId: true,
      teamId: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          teamEmail: {
            select: {
              email: true,
            },
          },
          createdAt: true,
        },
      },
    },
  });

  const uniqueEntities = new Map();

  activeSubscriptions.forEach((subscription) => {
    const isTeam = !!subscription.teamId;
    const entityId = isTeam ? `team-${subscription.teamId}` : `user-${subscription.userId}`;

    if (!uniqueEntities.has(entityId)) {
      uniqueEntities.set(entityId, {
        id: subscription.id,
        planId: subscription.planId,
        userId: subscription.userId,
        teamId: subscription.teamId,
        name: isTeam ? subscription.team?.name : subscription.user?.name || '',
        email: isTeam
          ? subscription.team?.teamEmail?.email || `Team ${subscription.team?.id}`
          : subscription.user?.email || '',
        createdAt: isTeam ? subscription.team?.createdAt : subscription.user?.createdAt,
        isTeam,
      });
    }
  });

  const subscriptionData = Array.from(uniqueEntities.values());

  const filteredSubscriptions = search
    ? subscriptionData.filter((sub) => {
        const searchLower = search.toLowerCase();
        return (
          sub.name?.toLowerCase().includes(searchLower) ||
          sub.email?.toLowerCase().includes(searchLower)
        );
      })
    : subscriptionData;

  const leaderboardWithVolume = await Promise.all(
    filteredSubscriptions.map(async (subscription) => {
      let signingVolume = 0;

      if (subscription.userId && !subscription.isTeam) {
        const personalCount = await prisma.document.count({
          where: {
            userId: subscription.userId,
            teamId: null,
            status: DocumentStatus.COMPLETED,
          },
        });

        signingVolume += personalCount;
      }

      if (subscription.teamId) {
        const teamCount = await prisma.document.count({
          where: {
            teamId: subscription.teamId,
            status: DocumentStatus.COMPLETED,
          },
        });

        signingVolume += teamCount;
      }

      return {
        ...subscription,
        signingVolume,
      };
    }),
  );

  const sortedResults = [...leaderboardWithVolume].sort((a, b) => {
    if (sortBy === 'name') {
      return sortOrder === 'asc'
        ? (a.name || '').localeCompare(b.name || '')
        : (b.name || '').localeCompare(a.name || '');
    }

    if (sortBy === 'createdAt') {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }

    return sortOrder === 'asc'
      ? a.signingVolume - b.signingVolume
      : b.signingVolume - a.signingVolume;
  });

  const paginatedResults = sortedResults.slice(skip, skip + validPerPage);

  const totalPages = Math.ceil(sortedResults.length / validPerPage);

  return {
    leaderboard: paginatedResults,
    totalPages,
  };
};
