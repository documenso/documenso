import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const CLEANUP_ANONYMOUS_TOKENS_JOB_DEFINITION_ID = 'internal.cleanup-anonymous-tokens';

const CLEANUP_ANONYMOUS_TOKENS_JOB_DEFINITION_SCHEMA = z.object({});

export type TCleanupAnonymousTokensJobDefinition = z.infer<typeof CLEANUP_ANONYMOUS_TOKENS_JOB_DEFINITION_SCHEMA>;

export const CLEANUP_ANONYMOUS_TOKENS_JOB_DEFINITION = {
  id: CLEANUP_ANONYMOUS_TOKENS_JOB_DEFINITION_ID,
  name: 'Cleanup Anonymous Verification Tokens',
  version: '1.0.0',
  trigger: {
    name: CLEANUP_ANONYMOUS_TOKENS_JOB_DEFINITION_ID,
    schema: CLEANUP_ANONYMOUS_TOKENS_JOB_DEFINITION_SCHEMA,
    cron: '0 */2 * * *', // Every 2 hours.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./cleanup-anonymous-tokens.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof CLEANUP_ANONYMOUS_TOKENS_JOB_DEFINITION_ID,
  TCleanupAnonymousTokensJobDefinition
>;
