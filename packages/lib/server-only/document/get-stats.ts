import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

export type GetStatsInput = {
  userId: number;
};

export const getStats = async ({ userId }: GetStatsInput) => {
  const result = await prisma.document.groupBy({
    by: ['status'],
    _count: {
      _all: true,
    },
    where: {
      userId,
    },
  });

  const stats: Record<DocumentStatus, number> = {
    [DocumentStatus.DRAFT]: 0,
    [DocumentStatus.PENDING]: 0,
    [DocumentStatus.COMPLETED]: 0,
  };

  result.forEach((stat) => {
    stats[stat.status] = stat._count._all;
  });

  return stats;
};
