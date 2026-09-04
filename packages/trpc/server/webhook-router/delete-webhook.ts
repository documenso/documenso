import { deleteWebhookById } from '@documenso/lib/server-only/webhooks/delete-webhook-by-id';

import { authenticatedProcedure } from '../trpc';
import { deleteWebhookMeta, ZDeleteWebhookRequestSchema, ZDeleteWebhookResponseSchema } from './delete-webhook.types';

export const deleteWebhookRoute = authenticatedProcedure
  .meta(deleteWebhookMeta)
  .input(ZDeleteWebhookRequestSchema)
  .output(ZDeleteWebhookResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    return await deleteWebhookById({
      id,
      teamId: ctx.teamId,
      userId: ctx.user.id,
    });
  });
