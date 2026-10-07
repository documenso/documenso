import { createPasskeyAuthenticationOptions } from '@documenso/lib/server-only/auth/create-passkey-authentication-options';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreatePasskeyAuthenticationOptionsRequestSchema,
  ZCreatePasskeyAuthenticationOptionsResponseSchema,
} from './create-passkey-authentication-options.types';

export const createPasskeyAuthenticationOptionsRoute = authenticatedProcedure
  .meta({ allowEmbedSession: true })
  .input(ZCreatePasskeyAuthenticationOptionsRequestSchema)
  .output(ZCreatePasskeyAuthenticationOptionsResponseSchema)
  .mutation(async ({ ctx, input }) => {
    return await createPasskeyAuthenticationOptions({
      userId: ctx.user.id,
      preferredPasskeyId: input?.preferredPasskeyId,
    });
  });
