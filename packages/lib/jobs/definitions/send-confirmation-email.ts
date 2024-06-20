import { z } from 'zod';

import { sendConfirmationToken } from '../../server-only/user/send-confirmation-token';
import type { JobDefinition } from '../client/_internal/job';

const SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_ID = 'send.signup.confirmation.email';

const SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  email: z.string().email(),
  force: z.boolean().optional(),
});

export const SEND_CONFIRMATION_EMAIL_JOB_DEFINITION = {
  id: SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Confirmation Email',
  version: '1.0.0',
  trigger: {
    name: SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload }) => {
    await sendConfirmationToken({
      email: payload.email,
      force: payload.force,
    });
  },
} as const satisfies JobDefinition<
  typeof SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_ID,
  z.infer<typeof SEND_CONFIRMATION_EMAIL_JOB_DEFINITION_SCHEMA>
>;
