import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SEND_2FA_TOKEN_EMAIL_JOB_DEFINITION_ID = 'send.2fa.token.email';

const SEND_2FA_TOKEN_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  envelopeId: z.string(),
  recipientId: z.number(),
});

export type TSend2FATokenEmailJobDefinition = z.infer<
  typeof SEND_2FA_TOKEN_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_2FA_TOKEN_EMAIL_JOB_DEFINITION = {
  id: SEND_2FA_TOKEN_EMAIL_JOB_DEFINITION_ID,
  name: 'Send 2FA Token Email',
  version: '1.0.0',
  trigger: {
    name: SEND_2FA_TOKEN_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_2FA_TOKEN_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-2fa-token-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_2FA_TOKEN_EMAIL_JOB_DEFINITION_ID,
  TSend2FATokenEmailJobDefinition
>;
