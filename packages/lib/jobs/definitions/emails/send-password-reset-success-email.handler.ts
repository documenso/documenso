import { sendResetPassword } from '../../../server-only/auth/send-reset-password';
import type { TSendPasswordResetSuccessEmailJobDefinition } from './send-password-reset-success-email';

export const run = async ({
  payload,
}: {
  payload: TSendPasswordResetSuccessEmailJobDefinition;
}) => {
  await sendResetPassword({
    userId: payload.userId,
  });
};
