import { z } from 'zod';

import { jobsClient } from '@documenso/lib/jobs/client';

import { procedure } from '../trpc';

export const ZSendConfirmationEmailRequestSchema = z.object({
  email: z.string().email().min(1),
});

export const sendConfirmationEmailRoute = procedure
  .input(ZSendConfirmationEmailRequestSchema)
  .mutation(async ({ input }) => {
    const { email } = input;

    await jobsClient.triggerJob({
      name: 'send.signup.confirmation.email',
      payload: {
        email,
      },
    });
  });
