import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_ORGANISATION_LIMIT_EXCEEDED_EMAIL_JOB_DEFINITION_ID = 'send.organisation-limit-exceeded.email';

const SEND_ORGANISATION_LIMIT_EXCEEDED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  organisationId: z.string(),
  counter: z.enum(['document', 'email', 'api']),
  kind: z.enum(['rateLimit', 'quota']),
  period: z.string(),
});

export type TSendOrganisationLimitExceededEmailJobDefinition = z.infer<
  typeof SEND_ORGANISATION_LIMIT_EXCEEDED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_ORGANISATION_LIMIT_EXCEEDED_EMAIL_JOB_DEFINITION = {
  id: SEND_ORGANISATION_LIMIT_EXCEEDED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Organisation Limit Exceeded Email',
  version: '1.0.0',
  trigger: {
    name: SEND_ORGANISATION_LIMIT_EXCEEDED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_ORGANISATION_LIMIT_EXCEEDED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-organisation-limit-exceeded-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_ORGANISATION_LIMIT_EXCEEDED_EMAIL_JOB_DEFINITION_ID,
  TSendOrganisationLimitExceededEmailJobDefinition
>;
