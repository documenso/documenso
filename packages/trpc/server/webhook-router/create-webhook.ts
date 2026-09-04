import { captureServerEvent } from '@documenso/lib/server-only/analytics/capture-server-event';
import { createWebhook } from '@documenso/lib/server-only/webhooks/create-webhook';
import { fireAndForget } from '@documenso/lib/universal/fire-and-forget';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { createWebhookMeta, ZCreateWebhookRequestSchema, ZCreateWebhookResponseSchema } from './create-webhook.types';

export const createWebhookRoute = authenticatedProcedure
  .meta(createWebhookMeta)
  .input(ZCreateWebhookRequestSchema)
  .output(ZCreateWebhookResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { enabled, eventTriggers, secret, webhookUrl } = input;

    const webhook = await createWebhook({
      enabled,
      secret,
      webhookUrl,
      eventTriggers,
      teamId: ctx.teamId,
      userId: ctx.user.id,
    });

    fireAndForget(async () => {
      const team = await prisma.team.findFirst({
        where: { id: ctx.teamId },
        select: { organisationId: true },
      });

      captureServerEvent({
        event: 'App: Webhook Created',
        userId: ctx.user.id,
        teamId: ctx.teamId,
        organisationId: team?.organisationId,
        properties: {
          triggerCount: eventTriggers.length,
        },
      });
    });

    return webhook;
  });
