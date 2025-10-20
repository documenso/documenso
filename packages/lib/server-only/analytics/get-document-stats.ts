import type { DocumentStatus, Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import type {
  AnalyticsFilters,
  DocumentStats,
  TeamDocumentStatsFilters,
  UserDocumentStatsFilters,
} from './types';

export const getDocumentStats = async (filters: AnalyticsFilters): Promise<DocumentStats> => {
  const { dateFrom, dateTo, ...entityFilter } = filters;

  const where: Prisma.EnvelopeWhereInput = {
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
  };

  const counts = await prisma.envelope.groupBy({
    by: ['status'],
    where,
    _count: {
      _all: true,
    },
  });

  const stats: DocumentStats = {
    [ExtendedDocumentStatus.DRAFT]: 0,
    [ExtendedDocumentStatus.PENDING]: 0,
    [ExtendedDocumentStatus.COMPLETED]: 0,
    [ExtendedDocumentStatus.REJECTED]: 0,
    [ExtendedDocumentStatus.ALL]: 0,
  };

  counts.forEach((stat: { status: DocumentStatus; _count: { _all: number } }) => {
    stats[stat.status as DocumentStatus] = stat._count._all;
    stats.ALL += stat._count._all;
  });

  return stats;
};

// Legacy wrapper functions for backwards compatibility
export const getTeamDocumentStats = async (filters: TeamDocumentStatsFilters) => {
  return getDocumentStats({
    teamId: filters.teamId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
};

export const getUserDocumentStats = async (filters: UserDocumentStatsFilters) => {
  return getDocumentStats({
    userId: filters.userId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
};
