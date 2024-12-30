import { z } from 'zod';

import { updatePassword } from '@documenso/lib/server-only/user/update-password';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { ZCurrentPasswordSchema, ZPasswordSchema } from '../auth-router/schema';
import { authenticatedProcedure } from '../trpc';

export const ZUpdatePasswordRequestSchema = z.object({
  currentPassword: ZCurrentPasswordSchema,
  password: ZPasswordSchema,
});

export const updatePasswordRoute = authenticatedProcedure
  .input(ZUpdatePasswordRequestSchema)
  .mutation(async ({ input, ctx }) => {
    const { password, currentPassword } = input;

    return await updatePassword({
      userId: ctx.user.id,
      password,
      currentPassword,
      requestMetadata: extractNextApiRequestMetadata(ctx.req),
    });
  });
