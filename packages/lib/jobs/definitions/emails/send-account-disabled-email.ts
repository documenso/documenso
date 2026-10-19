import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_ACCOUNT_DISABLED_EMAIL_JOB_DEFINITION_ID = 'send.account.disabled.email';

const SEND_ACCOUNT_DISABLED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  userId: z.number(),
  reason: z.literal('SIGNING_REQUEST_REPORTED'),
  envelopeId: z.string().optional(),
});

export type TSendAccountDisabledEmailJobDefinition = z.infer<typeof SEND_ACCOUNT_DISABLED_EMAIL_JOB_DEFINITION_SCHEMA>;

export const SEND_ACCOUNT_DISABLED_EMAIL_JOB_DEFINITION = {
  id: SEND_ACCOUNT_DISABLED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Account Disabled Email',
  version: '1.0.0',
  trigger: {
    name: SEND_ACCOUNT_DISABLED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_ACCOUNT_DISABLED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-account-disabled-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_ACCOUNT_DISABLED_EMAIL_JOB_DEFINITION_ID,
  TSendAccountDisabledEmailJobDefinition
>;
