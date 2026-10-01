import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_PASSWORD_RESET_SUCCESS_EMAIL_JOB_DEFINITION_ID = 'send.password.reset.success.email';

/**
 * How the password came to be changed, so the email can say so.
 *
 * - RESET: via the emailed reset link, unauthenticated.
 * - UPDATE: via account settings, while signed in.
 */
export const ZPasswordChangeSourceSchema = z.enum(['RESET', 'UPDATE']);

export type TPasswordChangeSource = z.infer<typeof ZPasswordChangeSourceSchema>;

const SEND_PASSWORD_RESET_SUCCESS_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  userId: z.number(),
  // Optional so jobs queued before this field existed still run; treated as RESET.
  source: ZPasswordChangeSourceSchema.optional(),
});

export type TSendPasswordResetSuccessEmailJobDefinition = z.infer<
  typeof SEND_PASSWORD_RESET_SUCCESS_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_PASSWORD_RESET_SUCCESS_EMAIL_JOB_DEFINITION = {
  id: SEND_PASSWORD_RESET_SUCCESS_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Password Reset Email',
  version: '1.0.0',
  trigger: {
    name: SEND_PASSWORD_RESET_SUCCESS_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_PASSWORD_RESET_SUCCESS_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload }) => {
    const handler = await import('./send-password-reset-success-email.handler');

    await handler.run({ payload });
  },
} as const satisfies JobDefinition<
  typeof SEND_PASSWORD_RESET_SUCCESS_EMAIL_JOB_DEFINITION_ID,
  TSendPasswordResetSuccessEmailJobDefinition
>;
