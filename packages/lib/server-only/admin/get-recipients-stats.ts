import { ReadStatus, SendStatus, SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export const getRecipientsStats = async () => {
  const results = await prisma.recipient.groupBy({
    by: ['readStatus', 'signingStatus', 'sendStatus'],
    _count: true,
  });

  const stats = {
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
