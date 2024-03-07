import { prisma } from '@documenso/prisma';
import type { WebhookTriggerEvents } from '@documenso/prisma/client';

export interface CreateWebhookOptions {
  webhookUrl: string;
  eventTriggers: WebhookTriggerEvents[];
  secret: string | null;
  enabled: boolean;
  userId: number;
  teamId?: number;
}

export const createWebhook = async ({
  webhookUrl,
  eventTriggers,
  secret,
  enabled,
  userId,
  teamId,
}: CreateWebhookOptions) => {
  if (teamId) {
    await prisma.team.findFirstOrThrow({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
    });
  }

  return await prisma.webhook.create({
    data: {
      webhookUrl,
      eventTriggers,
      secret,
      enabled,
      userId,
      teamId,
    },
  });
};
