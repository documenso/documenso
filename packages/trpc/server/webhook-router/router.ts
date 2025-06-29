import { createWebhook } from '@documenso/lib/server-only/webhooks/create-webhook';
import { deleteWebhookById } from '@documenso/lib/server-only/webhooks/delete-webhook-by-id';
import { editWebhook } from '@documenso/lib/server-only/webhooks/edit-webhook';
import { getWebhookById } from '@documenso/lib/server-only/webhooks/get-webhook-by-id';
import { getWebhooksByTeamId } from '@documenso/lib/server-only/webhooks/get-webhooks-by-team-id';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZCreateWebhookRequestSchema,
  ZDeleteWebhookRequestSchema,
  ZEditWebhookRequestSchema,
  ZGetTeamWebhooksRequestSchema,
  ZGetWebhookByIdRequestSchema,
} from './schema';

export const webhookRouter = router({
  getTeamWebhooks: authenticatedProcedure
    .input(ZGetTeamWebhooksRequestSchema)
    .query(async ({ ctx, input }) => {
      const { teamId } = input;

      ctx.logger.info({
        input: {
          teamId,
        },
      });

      return await getWebhooksByTeamId(teamId, ctx.user.id);
    }),

  getWebhookById: authenticatedProcedure
    .input(ZGetWebhookByIdRequestSchema)
    .query(async ({ input, ctx }) => {
      const { id, teamId } = input;

      ctx.logger.info({
        input: {
          id,
          teamId,
        },
      });

      return await getWebhookById({
        id,
        userId: ctx.user.id,
        teamId,
      });
    }),

  createWebhook: authenticatedProcedure
    .input(ZCreateWebhookRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const { enabled, eventTriggers, secret, webhookUrl, teamId } = input;

      ctx.logger.info({
        input: {
          teamId,
        },
      });

      return await createWebhook({
        enabled,
        secret,
        webhookUrl,
        eventTriggers,
        teamId,
        userId: ctx.user.id,
      });
    }),

  deleteWebhook: authenticatedProcedure
    .input(ZDeleteWebhookRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, teamId } = input;

      ctx.logger.info({
        input: {
          id,
          teamId,
        },
      });

      return await deleteWebhookById({
        id,
        teamId,
        userId: ctx.user.id,
      });
    }),

  editWebhook: authenticatedProcedure
    .input(ZEditWebhookRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, teamId, ...data } = input;

      ctx.logger.info({
        input: {
          id,
          teamId,
        },
      });

      return await editWebhook({
        id,
        data,
        userId: ctx.user.id,
        teamId,
      });
    }),
});
