import { createPasskey } from '@documenso/lib/server-only/auth/create-passkey';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

import { authenticatedProcedure } from '../trpc';
import { ZCreatePasskeyRequestSchema, ZCreatePasskeyResponseSchema } from './create-passkey.types';

export const createPasskeyRoute = authenticatedProcedure
  .input(ZCreatePasskeyRequestSchema)
  .output(ZCreatePasskeyResponseSchema)
  .mutation(async ({ ctx, input }) => {
    // SAFETY: ZRegistrationResponseJSONSchema validates the same fields RegistrationResponseJSON
    // declares; the assertion only restores the library type that zod inference loses.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const verificationResponse = input.verificationResponse as RegistrationResponseJSON;

    return await createPasskey({
      userId: ctx.user.id,
      verificationResponse,
      passkeyName: input.passkeyName,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  });
