import { prisma } from '@documenso/prisma';

import type { JobRunIO } from '../../client/_internal/job';
import type { TCleanupAnonymousTokensJobDefinition } from './cleanup-anonymous-tokens';

const BATCH_SIZE = 10_000;

export const run = async ({ io }: { payload: TCleanupAnonymousTokensJobDefinition; io: JobRunIO }) => {
  // Snapshot the cutoff so the run is bounded by the rows that were already
  // expired when it started, rather than chasing rows expiring mid-run.
  const cutoff = new Date();

  let totalDeleted = 0;
  let deleted = 0;

  do {
    // Postgres doesn't support DELETE with LIMIT, so batch via ctid to avoid
    // long-running transactions that could lock the table.
    deleted = await prisma.$executeRaw`
      DELETE FROM "AnonymousVerificationToken"
      WHERE ctid IN (
        SELECT ctid FROM "AnonymousVerificationToken"
        WHERE "expiresAt" < ${cutoff}
        LIMIT ${BATCH_SIZE}
      )
    `;

    totalDeleted += deleted;
  } while (deleted >= BATCH_SIZE);

  if (totalDeleted > 0) {
    io.logger.info(`Cleaned up ${totalDeleted} expired anonymous verification tokens`);
  } else {
    io.logger.info('No expired anonymous verification tokens to clean up');
  }
};
