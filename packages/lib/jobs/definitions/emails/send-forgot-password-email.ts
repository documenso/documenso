import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SEND_FORGOT_PASSWORD_EMAIL_JOB_DEFINITION_ID = 'send.forgot.password.email';

const SEND_FORGOT_PASSWORD_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  userId: z.number(),
});

export type TSendForgotPasswordEmailJobDefinition = z.infer<
  typeof SEND_FORGOT_PASSWORD_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_FORGOT_PASSWORD_EMAIL_JOB_DEFINITION = {
  id: SEND_FORGOT_PASSWORD_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Forgot Password Email',
  version: '1.0.0',
  trigger: {
    name: SEND_FORGOT_PASSWORD_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_FORGOT_PASSWORD_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-forgot-password-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_FORGOT_PASSWORD_EMAIL_JOB_DEFINITION_ID,
  TSendForgotPasswordEmailJobDefinition
>;
