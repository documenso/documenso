import { prisma } from '@documenso/prisma';
import type { WebhookTriggerEvents } from '@documenso/prisma/client';

export interface CreateWebhookOptions {
  webhookUrl: string;
  eventTriggers: WebhookTriggerEvents[];
  secret: string | null;
  enabled: boolean;
  userId: number;
}

export const createWebhook = async ({
  webhookUrl,
  eventTriggers,
  secret,
  enabled,
  userId,
}: CreateWebhookOptions) => {
  return await prisma.webhook.create({
    data: {
      webhookUrl,
      eventTriggers,
      secret,
      enabled,
      userId,
    },
  });
};
