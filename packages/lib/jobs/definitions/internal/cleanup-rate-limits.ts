import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const CLEANUP_RATE_LIMITS_JOB_DEFINITION_ID = 'internal.cleanup-rate-limits';

const CLEANUP_RATE_LIMITS_JOB_DEFINITION_SCHEMA = z.object({});

export type TCleanupRateLimitsJobDefinition = z.infer<
  typeof CLEANUP_RATE_LIMITS_JOB_DEFINITION_SCHEMA
>;

export const CLEANUP_RATE_LIMITS_JOB_DEFINITION = {
  id: CLEANUP_RATE_LIMITS_JOB_DEFINITION_ID,
  name: 'Cleanup Rate Limits',
  version: '1.0.0',
  trigger: {
    name: CLEANUP_RATE_LIMITS_JOB_DEFINITION_ID,
    schema: CLEANUP_RATE_LIMITS_JOB_DEFINITION_SCHEMA,
    cron: '*/15 * * * *', // Every 15 minutes.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./cleanup-rate-limits.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof CLEANUP_RATE_LIMITS_JOB_DEFINITION_ID,
  TCleanupRateLimitsJobDefinition
>;
