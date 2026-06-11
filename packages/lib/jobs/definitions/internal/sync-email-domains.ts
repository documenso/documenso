import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';
import { getJobCronExpression } from '../../get-job-cron-expression';

const SYNC_EMAIL_DOMAINS_JOB_DEFINITION_ID = 'internal.sync-email-domains';

const SYNC_EMAIL_DOMAINS_JOB_DEFINITION_SCHEMA = z.object({});

export type TSyncEmailDomainsJobDefinition = z.infer<typeof SYNC_EMAIL_DOMAINS_JOB_DEFINITION_SCHEMA>;

export const SYNC_EMAIL_DOMAINS_JOB_DEFINITION = {
  id: SYNC_EMAIL_DOMAINS_JOB_DEFINITION_ID,
  name: 'Sync Email Domains',
  version: '1.0.0',
  trigger: {
    name: SYNC_EMAIL_DOMAINS_JOB_DEFINITION_ID,
    schema: SYNC_EMAIL_DOMAINS_JOB_DEFINITION_SCHEMA,
    cron: getJobCronExpression('NEXT_PRIVATE_JOBS_SYNC_EMAIL_DOMAINS_CRON', '0 * * * *'), // Every hour, on the hour.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./sync-email-domains.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<typeof SYNC_EMAIL_DOMAINS_JOB_DEFINITION_ID, TSyncEmailDomainsJobDefinition>;
