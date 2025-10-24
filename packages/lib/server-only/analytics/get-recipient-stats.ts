import { type Prisma, ReadStatus, SendStatus, SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import type {
  AnalyticsFilters,
  RecipientStats,
  TeamRecipientsStatsFilters,
  UserRecipientsStatsFilters,
} from './types';

export const getRecipientStats = async (filters: AnalyticsFilters): Promise<RecipientStats> => {
  const { dateFrom, dateTo, ...entityFilter } = filters;

  const where: Prisma.RecipientWhereInput = {
    envelope: {
      ...entityFilter,
      deletedAt: null,
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: dateFrom }),
              ...(dateTo && { lte: dateTo }),
            },
          }
        : {}),
    },
  };

  const results = await prisma.recipient.groupBy({
    by: ['readStatus', 'signingStatus', 'sendStatus'],
    where,
    _count: true,
  });

  const stats: RecipientStats = {
    TOTAL_RECIPIENTS: 0,
    [ReadStatus.OPENED]: 0,
    [ReadStatus.NOT_OPENED]: 0,
    [SigningStatus.SIGNED]: 0,
    [SigningStatus.NOT_SIGNED]: 0,
    [SigningStatus.REJECTED]: 0,
    [SendStatus.SENT]: 0,
    [SendStatus.NOT_SENT]: 0,
  };

  results.forEach((result) => {
    const { readStatus, signingStatus, sendStatus, _count } = result;

    stats[readStatus] += _count;
    stats[signingStatus] += _count;
    stats[sendStatus] += _count;

    stats.TOTAL_RECIPIENTS += _count;
  });

  return stats;
};

// Legacy wrapper functions for backwards compatibility
export const getTeamRecipientsStats = async (filters: TeamRecipientsStatsFilters) => {
  return getRecipientStats({
    teamId: filters.teamId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
};

export const getUserRecipientsStats = async (filters: UserRecipientsStatsFilters) => {
  return getRecipientStats({
    userId: filters.userId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
};
