import { createPasskey } from '@documenso/lib/server-only/auth/create-passkey';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

import { authenticatedProcedure } from '../trpc';
import { twoFactorInstanceOnly } from '../two-factor-enforcement/enforce';
import { ZCreatePasskeyRequestSchema, ZCreatePasskeyResponseSchema } from './create-passkey.types';

export const createPasskeyRoute = authenticatedProcedure
  .input(ZCreatePasskeyRequestSchema)
  .output(ZCreatePasskeyResponseSchema)
  // 2FA enforcement: user-level passkey credential management; no organisation scope. Instance assert still applies.
  .use(twoFactorInstanceOnly())
  .mutation(async ({ ctx, input }) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const verificationResponse = input.verificationResponse as RegistrationResponseJSON;

    return await createPasskey({
      userId: ctx.user.id,
      verificationResponse,
      passkeyName: input.passkeyName,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  });
