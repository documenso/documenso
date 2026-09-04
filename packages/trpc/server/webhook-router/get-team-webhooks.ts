import { getWebhooksByTeamId } from '@documenso/lib/server-only/webhooks/get-webhooks-by-team-id';

import { authenticatedProcedure } from '../trpc';
import {
  getTeamWebhooksMeta,
  ZGetTeamWebhooksRequestSchema,
  ZGetTeamWebhooksResponseSchema,
} from './get-team-webhooks.types';

export const getTeamWebhooksRoute = authenticatedProcedure
  .meta(getTeamWebhooksMeta)
  .input(ZGetTeamWebhooksRequestSchema)
  .output(ZGetTeamWebhooksResponseSchema)
  .query(async ({ ctx }) => {
    ctx.logger.info({
      input: {
        teamId: ctx.teamId,
      },
    });

    return await getWebhooksByTeamId(ctx.teamId, ctx.user.id);
  });
