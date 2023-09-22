import { prisma } from '@documenso/prisma';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

export const getDocumentStats = async () => {
  const counts = await prisma.document.groupBy({
    by: ['status'],
    _count: {
      _all: true,
    },
  });

  const stats: Record<Exclude<ExtendedDocumentStatus, 'INBOX'>, number> = {
    [ExtendedDocumentStatus.DRAFT]: 0,
    [ExtendedDocumentStatus.PENDING]: 0,
    [ExtendedDocumentStatus.COMPLETED]: 0,
    [ExtendedDocumentStatus.ALL]: 0,
  };

  counts.forEach((stat) => {
    stats[stat.status] = stat._count._all;

    stats.ALL += stat._count._all;
  });

  return stats;
};
