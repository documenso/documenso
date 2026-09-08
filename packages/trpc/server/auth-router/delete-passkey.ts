import { deletePasskey } from '@documenso/lib/server-only/auth/delete-passkey';

import { authenticatedProcedure } from '../trpc';
import { twoFactorInstanceOnly } from '../two-factor-enforcement/enforce';
import { ZDeletePasskeyRequestSchema, ZDeletePasskeyResponseSchema } from './delete-passkey.types';

export const deletePasskeyRoute = authenticatedProcedure
  .input(ZDeletePasskeyRequestSchema)
  .output(ZDeletePasskeyResponseSchema)
  // 2FA enforcement: user-level passkey credential management; no organisation scope. Instance assert still applies.
  .use(twoFactorInstanceOnly())
  .mutation(async ({ ctx, input }) => {
    const { passkeyId } = input;

    ctx.logger.info({
      input: {
        passkeyId,
      },
    });

    await deletePasskey({
      userId: ctx.user.id,
      passkeyId,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  });
