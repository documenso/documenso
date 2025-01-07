import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_ID = 'send.signup.confirmation.email';

const SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  email: z.string().email(),
  force: z.boolean().optional(),
});

export type TSendConfirmationEmailJobDefinition = z.infer<
  typeof SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_CONFIRMATION_EMAIL_JOB_DEFINITION = {
  id: SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Confirmation Email',
  version: '1.0.0',
  trigger: {
    name: SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload }) => {
    const handler = await import('./send-confirmation-email.handler');

    await handler.run({ payload });
  },
} as const satisfies JobDefinition<
  typeof SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_ID,
  TSendConfirmationEmailJobDefinition
>;
