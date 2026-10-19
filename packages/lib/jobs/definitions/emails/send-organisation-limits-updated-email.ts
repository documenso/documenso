import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_ORGANISATION_LIMITS_UPDATED_EMAIL_JOB_DEFINITION_ID = 'send.organisation-limits-updated.email';

const SEND_ORGANISATION_LIMITS_UPDATED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  organisationId: z.string(),
});

export type TSendOrganisationLimitsUpdatedEmailJobDefinition = z.infer<
  typeof SEND_ORGANISATION_LIMITS_UPDATED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_ORGANISATION_LIMITS_UPDATED_EMAIL_JOB_DEFINITION = {
  id: SEND_ORGANISATION_LIMITS_UPDATED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Organisation Limits Updated Email',
  version: '1.0.0',
  trigger: {
    name: SEND_ORGANISATION_LIMITS_UPDATED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_ORGANISATION_LIMITS_UPDATED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-organisation-limits-updated-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_ORGANISATION_LIMITS_UPDATED_EMAIL_JOB_DEFINITION_ID,
  TSendOrganisationLimitsUpdatedEmailJobDefinition
>;
