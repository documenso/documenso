import { z } from 'zod';

import { setAvatarImage } from '@documenso/lib/server-only/profile/set-avatar-image';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { authenticatedProcedure } from '../trpc';

export const ZSetProfileImageRequestSchema = z.object({
  bytes: z.string().nullish(),
  teamId: z.number().min(1).nullish(),
});

export const setProfileImageRoute = authenticatedProcedure
  .input(ZSetProfileImageRequestSchema)
  .mutation(async ({ input, ctx }) => {
    const { bytes, teamId } = input;

    return await setAvatarImage({
      userId: ctx.user.id,
      teamId,
      bytes,
      requestMetadata: extractNextApiRequestMetadata(ctx.req),
    });
  });
