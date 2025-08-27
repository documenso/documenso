import { updatePasskey } from '@documenso/lib/server-only/auth/update-passkey';

import { authenticatedProcedure } from '../trpc';
import { ZUpdatePasskeyRequestSchema, ZUpdatePasskeyResponseSchema } from './update-passkey.types';

export const updatePasskeyRoute = authenticatedProcedure
  .input(ZUpdatePasskeyRequestSchema)
  .output(ZUpdatePasskeyResponseSchema)
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
