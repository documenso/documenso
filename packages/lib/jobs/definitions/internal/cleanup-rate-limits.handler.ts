import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

import type { JobRunIO } from '../../client/_internal/job';
import type { TCleanupRateLimitsJobDefinition } from './cleanup-rate-limits';

const BATCH_SIZE = 10_000;

export const run = async ({ io }: { payload: TCleanupRateLimitsJobDefinition; io: JobRunIO }) => {
  const cutoff = DateTime.now().minus({ hours: 24 }).toJSDate();

  let totalDeleted = 0;
  let deleted = 0;

  do {
    // Prisma doesn't support DELETE with LIMIT, so use raw SQL for batching
    // to avoid long-running transactions that could lock the table.
    deleted = await prisma.$executeRaw`
      DELETE FROM "RateLimit"
      WHERE ctid IN (
        SELECT ctid FROM "RateLimit"
        WHERE "createdAt" < ${cutoff}
        LIMIT ${BATCH_SIZE}
      )
    `;

    totalDeleted += deleted;
  } while (deleted >= BATCH_SIZE);

  if (totalDeleted > 0) {
    io.logger.info(`Cleaned up ${totalDeleted} expired rate limit entries`);
  } else {
    io.logger.info('No expired rate limit entries to clean up');
  }
};
