import { sendConfirmationToken } from '../../../server-only/user/send-confirmation-token';
import type { TSendConfirmationEmailJobDefinition } from './send-confirmation-email';

export const run = async ({ payload }: { payload: TSendConfirmationEmailJobDefinition }) => {
  await sendConfirmationToken({
    email: payload.email,
    force: payload.force,
  });
};
