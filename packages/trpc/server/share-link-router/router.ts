import { TRPCError } from '@trpc/server';

import { createOrGetShareLink } from '@documenso/lib/server-only/share/create-or-get-share-link';

import { procedure, router } from '../trpc';
import { ZCreateOrGetShareLinkMutationSchema } from './schema';

export const shareLinkRouter = router({
  createOrGetShareLink: procedure
    .input(ZCreateOrGetShareLinkMutationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { documentId, token } = input;

        if (token) {
          return await createOrGetShareLink({ documentId, token });
        }

        if (!ctx.user?.id) {
          throw new Error(
            'You must either provide a token or be logged in to create a sharing link.',
          );
        }

        return await createOrGetShareLink({ documentId, userId: ctx.user.id });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to create a sharing link.',
        });
      }
    }),
});
