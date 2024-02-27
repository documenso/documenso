import { TRPCError } from '@trpc/server';

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
    try {
      return await getWebhooksByUserId(ctx.user.id);
    } catch (err) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to fetch your webhooks. Please try again later.',
      });
    }
  }),

  getTeamWebhooks: authenticatedProcedure
    .input(ZGetTeamWebhooksQuerySchema)
    .query(async ({ ctx, input }) => {
      const { teamId } = input;

      try {
        return await getWebhooksByTeamId(teamId, ctx.user.id);
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to fetch your webhooks. Please try again later.',
        });
      }
    }),

  getWebhookById: authenticatedProcedure
    .input(ZGetWebhookByIdQuerySchema)
    .query(async ({ input, ctx }) => {
      try {
        const { id, teamId } = input;

        return await getWebhookById({
          id,
          userId: ctx.user.id,
          teamId,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to fetch your webhook. Please try again later.',
        });
      }
    }),

  createWebhook: authenticatedProcedure
    .input(ZCreateWebhookMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { enabled, eventTriggers, secret, webhookUrl, teamId } = input;

      try {
        return await createWebhook({
          enabled,
          secret,
          webhookUrl,
          eventTriggers,
          teamId,
          userId: ctx.user.id,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to create this webhook. Please try again later.',
        });
      }
    }),

  deleteWebhook: authenticatedProcedure
    .input(ZDeleteWebhookMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, teamId } = input;

        return await deleteWebhookById({
          id,
          teamId,
          userId: ctx.user.id,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to create this webhook. Please try again later.',
        });
      }
    }),

  editWebhook: authenticatedProcedure
    .input(ZEditWebhookMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, teamId, ...data } = input;

        return await editWebhook({
          id,
          data,
          userId: ctx.user.id,
          teamId,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to create this webhook. Please try again later.',
        });
      }
    }),
});
