import { getWebhookById } from '@documenso/lib/server-only/webhooks/get-webhook-by-id';

import { authenticatedProcedure } from '../trpc';
import {
  getWebhookByIdMeta,
  ZGetWebhookByIdRequestSchema,
  ZGetWebhookByIdResponseSchema,
} from './get-webhook-by-id.types';

export const getWebhookByIdRoute = authenticatedProcedure
  .meta(getWebhookByIdMeta)
  .input(ZGetWebhookByIdRequestSchema)
  .output(ZGetWebhookByIdResponseSchema)
  .query(async ({ input, ctx }) => {
    const { id } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    return await getWebhookById({
      id,
      userId: ctx.user.id,
      teamId: ctx.teamId,
    });
  });
