import { TRPCError } from '@trpc/server';

import { createSharingId } from '@documenso/lib/server-only/share/create-share-id';

import { procedure, router } from '../trpc';
import { ZShareLinkSchema } from './schema';

export const shareRouter = router({
  create: procedure.input(ZShareLinkSchema).mutation(async ({ input }) => {
    try {
      const { documentId, recipientId } = input;

      return await createSharingId({ documentId, recipientId });
    } catch (err) {
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to create a sharing link.',
      });
    }
  }),
});
