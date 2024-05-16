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
    handler: async ({ payload, io }) => {
      console.log('---- start job ----');

      // eslint-disable-next-line @typescript-eslint/require-await
      const result = await io.runTask('console-log-1', async () => {
        console.log('Task 1');

        return 5;
      });

      console.log({ result });

      console.log('always runs');

      // eslint-disable-next-line @typescript-eslint/require-await
      await io.runTask('console-log-2', async () => {
        await Promise.resolve(null);
        throw new Error('dang2');
      });

      console.log('---- end job ----');

      // throw new Error('dang')
      await sendConfirmationToken({
        email: payload.email,
        force: payload.force,
      });
    },
  });
};
