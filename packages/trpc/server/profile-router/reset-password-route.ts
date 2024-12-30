import { z } from 'zod';

import { resetPassword } from '@documenso/lib/server-only/user/reset-password';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { ZPasswordSchema } from '../auth-router/schema';
import { procedure } from '../trpc';

export const ZResetPasswordRequestSchema = z.object({
  password: ZPasswordSchema,
  token: z.string().min(1),
});

export const resetPasswordRoute = procedure
  .input(ZResetPasswordRequestSchema)
  .mutation(async ({ input, ctx }) => {
    const { password, token } = input;

    return await resetPassword({
      token,
      password,
      requestMetadata: extractNextApiRequestMetadata(ctx.req),
    });
  });
