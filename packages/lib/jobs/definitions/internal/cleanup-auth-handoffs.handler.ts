import { prisma } from '@documenso/prisma';

import type { JobRunIO } from '../../client/_internal/job';
import type { TCleanupAuthHandoffsJobDefinition } from './cleanup-auth-handoffs';

export const run = async ({ io }: { payload: TCleanupAuthHandoffsJobDefinition; io: JobRunIO }) => {
  const { count } = await prisma.authHandoff.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  if (count > 0) {
    io.logger.info(`Cleaned up ${count} expired auth handoffs`);
  } else {
    io.logger.info('No expired auth handoffs to clean up');
  }
};
