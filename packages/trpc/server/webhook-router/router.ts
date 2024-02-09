import { TRPCError } from '@trpc/server';

import { createWebhook } from '@documenso/lib/server-only/webhooks/create-webhook';
import { getWebhooksByUserId } from '@documenso/lib/server-only/webhooks/get-webhooks-by-user-id';

import { authenticatedProcedure, router } from '../trpc';
import { ZCreateWebhookFormSchema } from './schema';

export const webhookRouter = router({
  getWebhooks: authenticatedProcedure.query(async ({ ctx }) => {
    try {
      return await getWebhooksByUserId(ctx.user.id);
    } catch (err) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to fetch your webhooks. Please try again later.',
      });
    }
  }),
  createWebhook: authenticatedProcedure
    .input(ZCreateWebhookFormSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await createWebhook({
          ...input,
          userId: ctx.user.id,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to create this webhook. Please try again later.',
        });
      }
    }),
});
