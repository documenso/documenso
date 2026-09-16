import { createPasskeyAuthenticationOptions } from '@documenso/lib/server-only/auth/create-passkey-authentication-options';

import { authenticatedProcedure } from '../trpc';
import { twoFactorInstanceOnly } from '../two-factor-enforcement/enforce';
import {
  ZCreatePasskeyAuthenticationOptionsRequestSchema,
  ZCreatePasskeyAuthenticationOptionsResponseSchema,
} from './create-passkey-authentication-options.types';

export const createPasskeyAuthenticationOptionsRoute = authenticatedProcedure
  .input(ZCreatePasskeyAuthenticationOptionsRequestSchema)
  .output(ZCreatePasskeyAuthenticationOptionsResponseSchema)
  // 2FA enforcement: user-level passkey credential management; no organisation scope. Instance assert still applies.
  .use(twoFactorInstanceOnly())
  .mutation(async ({ ctx, input }) => {
    return await createPasskeyAuthenticationOptions({
      userId: ctx.user.id,
      preferredPasskeyId: input?.preferredPasskeyId,
    });
  });
