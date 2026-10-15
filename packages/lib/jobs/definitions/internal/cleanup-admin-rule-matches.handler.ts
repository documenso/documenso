import { prisma } from '@documenso/prisma';
import { DateTime } from 'luxon';

import { ADMIN_RULE_MATCH_RETENTION_DAYS } from '../../../constants/admin-rules';
import type { JobRunIO } from '../../client/_internal/job';
import type { TCleanupAdminRuleMatchesJobDefinition } from './cleanup-admin-rule-matches';

const BATCH_SIZE = 10_000;

export const run = async ({ io }: { payload: TCleanupAdminRuleMatchesJobDefinition; io: JobRunIO }) => {
  const cutoff = DateTime.now().minus({ days: ADMIN_RULE_MATCH_RETENTION_DAYS }).toJSDate();

  let totalDeleted = 0;
  let deleted = 0;

  do {
    // Prisma doesn't support DELETE with LIMIT, so use raw SQL for batching
    // to avoid long-running transactions that could lock the table.
    deleted = await prisma.$executeRaw`
      DELETE FROM "AdminRuleMatch"
      WHERE ctid IN (
        SELECT ctid FROM "AdminRuleMatch"
        WHERE "createdAt" < ${cutoff}
        LIMIT ${BATCH_SIZE}
      )
    `;

    totalDeleted += deleted;
  } while (deleted >= BATCH_SIZE);

  if (totalDeleted > 0) {
    io.logger.info(`Cleaned up ${totalDeleted} expired admin rule matches`);
  } else {
    io.logger.info('No expired admin rule matches to clean up');
  }
};
