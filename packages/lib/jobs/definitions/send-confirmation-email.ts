import { z } from 'zod';

import { sendConfirmationToken } from '../../server-only/user/send-confirmation-token';
import type { JobClient } from '../client/client';

export const registerSendConfirmationEmailJob = (client: JobClient) => {
  client.defineJob({
    id: 'send.confirmation.email',
    name: 'Send Confirmation Email',
    version: '1.0.0',
    trigger: {
      name: 'send.confirmation.email',
      schema: z.object({
        email: z.string().email(),
        force: z.boolean().optional(),
      }),
    },
    handler: async ({ payload }) => {
      await sendConfirmationToken({
        email: payload.email,
        force: payload.force,
      });
    },
  });
};
