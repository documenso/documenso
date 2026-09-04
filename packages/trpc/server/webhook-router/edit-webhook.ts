import { editWebhook } from '@documenso/lib/server-only/webhooks/edit-webhook';

import { authenticatedProcedure } from '../trpc';
import { editWebhookMeta, ZEditWebhookRequestSchema, ZEditWebhookResponseSchema } from './edit-webhook.types';

export const editWebhookRoute = authenticatedProcedure
  .meta(editWebhookMeta)
  .input(ZEditWebhookRequestSchema)
  .output(ZEditWebhookResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id, ...data } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    return await editWebhook({
      id,
      data,
      userId: ctx.user.id,
      teamId: ctx.teamId,
    });
  });
