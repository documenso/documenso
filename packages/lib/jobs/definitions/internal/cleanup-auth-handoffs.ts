import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const CLEANUP_AUTH_HANDOFFS_JOB_DEFINITION_ID = 'internal.cleanup-auth-handoffs';

const CLEANUP_AUTH_HANDOFFS_JOB_DEFINITION_SCHEMA = z.object({});

export type TCleanupAuthHandoffsJobDefinition = z.infer<typeof CLEANUP_AUTH_HANDOFFS_JOB_DEFINITION_SCHEMA>;

export const CLEANUP_AUTH_HANDOFFS_JOB_DEFINITION = {
  id: CLEANUP_AUTH_HANDOFFS_JOB_DEFINITION_ID,
  name: 'Cleanup Auth Handoffs',
  version: '1.0.0',
  trigger: {
    name: CLEANUP_AUTH_HANDOFFS_JOB_DEFINITION_ID,
    schema: CLEANUP_AUTH_HANDOFFS_JOB_DEFINITION_SCHEMA,
    cron: '*/15 * * * *', // Every 15 minutes.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./cleanup-auth-handoffs.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<typeof CLEANUP_AUTH_HANDOFFS_JOB_DEFINITION_ID, TCleanupAuthHandoffsJobDefinition>;
