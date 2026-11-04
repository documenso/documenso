import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const CLEANUP_ADMIN_RULE_MATCHES_JOB_DEFINITION_ID = 'internal.cleanup-admin-rule-matches';

const CLEANUP_ADMIN_RULE_MATCHES_JOB_DEFINITION_SCHEMA = z.object({});

export type TCleanupAdminRuleMatchesJobDefinition = z.infer<typeof CLEANUP_ADMIN_RULE_MATCHES_JOB_DEFINITION_SCHEMA>;

export const CLEANUP_ADMIN_RULE_MATCHES_JOB_DEFINITION = {
  id: CLEANUP_ADMIN_RULE_MATCHES_JOB_DEFINITION_ID,
  name: 'Cleanup Admin Rule Matches',
  version: '1.0.0',
  trigger: {
    name: CLEANUP_ADMIN_RULE_MATCHES_JOB_DEFINITION_ID,
    schema: CLEANUP_ADMIN_RULE_MATCHES_JOB_DEFINITION_SCHEMA,
    cron: '0 3 * * *', // Daily at 03:00.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./cleanup-admin-rule-matches.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof CLEANUP_ADMIN_RULE_MATCHES_JOB_DEFINITION_ID,
  TCleanupAdminRuleMatchesJobDefinition
>;
