import { z } from 'zod';

import { updateProfile } from '@documenso/lib/server-only/user/update-profile';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { authenticatedProcedure } from '../trpc';

export const ZUpdateProfileRequestSchema = z.object({
  name: z.string().min(1),
  signature: z.string(),
});

export const updateProfileRoute = authenticatedProcedure
  .input(ZUpdateProfileRequestSchema)
  .mutation(async ({ input, ctx }) => {
    const { name, signature } = input;

    return await updateProfile({
      userId: ctx.user.id,
      name,
      signature,
      requestMetadata: extractNextApiRequestMetadata(ctx.req),
    });
  });
