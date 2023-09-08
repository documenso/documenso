import { prisma } from '@documenso/prisma';
import { ReadStatus, SendStatus, SigningStatus } from '@documenso/prisma/client';

export const getRecipientsStats = async () => {
  const results = await prisma.recipient.groupBy({
    by: ['readStatus', 'signingStatus', 'sendStatus'],
    _count: true,
  });

  return {
    TOTAL_RECIPIENTS: results.length,
    [ReadStatus.OPENED]: results.filter((r) => r.readStatus === 'OPENED')?.[0]?._count ?? 0,
    [ReadStatus.NOT_OPENED]: results.filter((r) => r.readStatus === 'NOT_OPENED')?.[0]?._count ?? 0,
    [SigningStatus.SIGNED]: results.filter((r) => r.signingStatus === 'SIGNED')?.[0]?._count ?? 0,
    [SigningStatus.NOT_SIGNED]:
      results.filter((r) => r.signingStatus === 'NOT_SIGNED')?.[0]?._count ?? 0,
    [SendStatus.SENT]: results.filter((r) => r.sendStatus === 'SENT')?.[0]?._count ?? 0,
    [SendStatus.NOT_SENT]: results.filter((r) => r.sendStatus === 'NOT_SENT')?.[0]?._count ?? 0,
  };
};
