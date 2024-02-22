import { prisma } from '@documenso/prisma';
import type { WebhookTriggerEvents } from '@documenso/prisma/client';

export type GetAllWebhooksOptions = {
  eventTrigger: WebhookTriggerEvents;
};

export const getAllWebhooks = async ({ eventTrigger }: GetAllWebhooksOptions) => {
  return prisma.webhook.findMany({
    where: {
      eventTriggers: {
        has: eventTrigger,
      },
      enabled: true,
    },
  });
};
