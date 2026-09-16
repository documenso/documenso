import { updatePasskey } from '@documenso/lib/server-only/auth/update-passkey';

import { authenticatedProcedure } from '../trpc';
import { twoFactorInstanceOnly } from '../two-factor-enforcement/enforce';
import { ZUpdatePasskeyRequestSchema, ZUpdatePasskeyResponseSchema } from './update-passkey.types';

export const updatePasskeyRoute = authenticatedProcedure
  .input(ZUpdatePasskeyRequestSchema)
  .output(ZUpdatePasskeyResponseSchema)
  // 2FA enforcement: user-level passkey credential management; no organisation scope. Instance assert still applies.
  .use(twoFactorInstanceOnly())
  .mutation(async ({ ctx, input }) => {
    const { passkeyId, name } = input;

    ctx.logger.info({
      input: {
        passkeyId,
      },
    });

    await updatePasskey({
      userId: ctx.user.id,
      passkeyId,
      name,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  });
