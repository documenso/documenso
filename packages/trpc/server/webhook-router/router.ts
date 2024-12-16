import { createWebhook } from '@documenso/lib/server-only/webhooks/create-webhook';
import { deleteWebhookById } from '@documenso/lib/server-only/webhooks/delete-webhook-by-id';
import { editWebhook } from '@documenso/lib/server-only/webhooks/edit-webhook';
import { getWebhookById } from '@documenso/lib/server-only/webhooks/get-webhook-by-id';
import { getWebhooksByTeamId } from '@documenso/lib/server-only/webhooks/get-webhooks-by-team-id';
import { getWebhooksByUserId } from '@documenso/lib/server-only/webhooks/get-webhooks-by-user-id';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZCreateWebhookMutationSchema,
  ZDeleteWebhookMutationSchema,
  ZEditWebhookMutationSchema,
  ZGetTeamWebhooksQuerySchema,
  ZGetWebhookByIdQuerySchema,
} from './schema';

export const webhookRouter = router({
  getWebhooks: authenticatedProcedure.query(async ({ ctx }) => {
    return await getWebhooksByUserId(ctx.user.id);
  }),

  getTeamWebhooks: authenticatedProcedure
    .input(ZGetTeamWebhooksQuerySchema)
    .query(async ({ ctx, input }) => {
      const { teamId } = input;

      return await getWebhooksByTeamId(teamId, ctx.user.id);
    }),

  getWebhookById: authenticatedProcedure
    .input(ZGetWebhookByIdQuerySchema)
    .query(async ({ input, ctx }) => {
      const { id, teamId } = input;

      return await getWebhookById({
        id,
        userId: ctx.user.id,
        teamId,
      });
    }),

  createWebhook: authenticatedProcedure
    .input(ZCreateWebhookMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { enabled, eventTriggers, secret, webhookUrl, teamId } = input;

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
    .input(ZDeleteWebhookMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, teamId } = input;

      return await deleteWebhookById({
        id,
        teamId,
        userId: ctx.user.id,
      });
    }),

  editWebhook: authenticatedProcedure
    .input(ZEditWebhookMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, teamId, ...data } = input;

      return await editWebhook({
        id,
        data,
        userId: ctx.user.id,
        teamId,
      });
    }),
});
