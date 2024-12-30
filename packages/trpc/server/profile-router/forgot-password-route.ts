import { z } from 'zod';

import { forgotPassword } from '@documenso/lib/server-only/user/forgot-password';

import { procedure } from '../trpc';

export const ZForgotPasswordRequestSchema = z.object({
  email: z.string().email().min(1),
});

export const forgotPasswordRoute = procedure
  .input(ZForgotPasswordRequestSchema)
  .mutation(async ({ input }) => {
    const { email } = input;

    return await forgotPassword({
      email,
    });
  });
