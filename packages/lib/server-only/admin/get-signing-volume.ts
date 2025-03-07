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

  const userSubscriptionsMap = new Map();
  const teamSubscriptionsMap = new Map();

  activeSubscriptions.forEach((subscription) => {
    const isTeam = !!subscription.teamId;

    if (isTeam && subscription.teamId) {
      if (!teamSubscriptionsMap.has(subscription.teamId)) {
        teamSubscriptionsMap.set(subscription.teamId, {
          id: subscription.id,
          planId: subscription.planId,
          teamId: subscription.teamId,
          name: subscription.team?.name || '',
          email: subscription.team?.teamEmail?.email || `Team ${subscription.team?.id}`,
          createdAt: subscription.team?.createdAt,
          isTeam: true,
          subscriptionIds: [subscription.id],
        });
      } else {
        const existingTeam = teamSubscriptionsMap.get(subscription.teamId);
        existingTeam.subscriptionIds.push(subscription.id);
      }
    } else if (subscription.userId) {
      if (!userSubscriptionsMap.has(subscription.userId)) {
        userSubscriptionsMap.set(subscription.userId, {
          id: subscription.id,
          planId: subscription.planId,
          userId: subscription.userId,
          name: subscription.user?.name || '',
          email: subscription.user?.email || '',
          createdAt: subscription.user?.createdAt,
          isTeam: false,
          subscriptionIds: [subscription.id],
        });
      } else {
        const existingUser = userSubscriptionsMap.get(subscription.userId);
        existingUser.subscriptionIds.push(subscription.id);
      }
    }
  });

  const subscriptions = [
    ...Array.from(userSubscriptionsMap.values()),
    ...Array.from(teamSubscriptionsMap.values()),
  ];

  const filteredSubscriptions = search
    ? subscriptions.filter((sub) => {
        const searchLower = search.toLowerCase();
        return (
          sub.name?.toLowerCase().includes(searchLower) ||
          sub.email?.toLowerCase().includes(searchLower)
        );
      })
    : subscriptions;

  const signingVolume = await Promise.all(
    filteredSubscriptions.map(async (subscription) => {
      let signingVolume = 0;

      if (subscription.userId && !subscription.isTeam) {
        const personalCount = await prisma.document.count({
          where: {
            userId: subscription.userId,
            status: DocumentStatus.COMPLETED,
            teamId: null,
          },
        });

        signingVolume += personalCount;

        const userTeams = await prisma.teamMember.findMany({
          where: {
            userId: subscription.userId,
          },
          select: {
            teamId: true,
          },
        });

        if (userTeams.length > 0) {
          const teamIds = userTeams.map((team) => team.teamId);
          const teamCount = await prisma.document.count({
            where: {
              teamId: {
                in: teamIds,
              },
              status: DocumentStatus.COMPLETED,
            },
          });

          signingVolume += teamCount;
        }
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

  const sortedResults = [...signingVolume].sort((a, b) => {
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
