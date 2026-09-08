import { createPasskeyRegistrationOptions } from '@documenso/lib/server-only/auth/create-passkey-registration-options';

import { authenticatedProcedure } from '../trpc';
import { twoFactorInstanceOnly } from '../two-factor-enforcement/enforce';
import {
  ZCreatePasskeyRegistrationOptionsRequestSchema,
  ZCreatePasskeyRegistrationOptionsResponseSchema,
} from './create-passkey-registration-options.types';

export const createPasskeyRegistrationOptionsRoute = authenticatedProcedure
  .input(ZCreatePasskeyRegistrationOptionsRequestSchema)
  .output(ZCreatePasskeyRegistrationOptionsResponseSchema)
  // 2FA enforcement: user-level passkey credential management; no organisation scope. Instance assert still applies.
  .use(twoFactorInstanceOnly())
  .mutation(async ({ ctx }) => {
    return await createPasskeyRegistrationOptions({
      userId: ctx.user.id,
    });
  });
