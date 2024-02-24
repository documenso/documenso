import { prisma } from '@documenso/prisma';
import type { WebhookTriggerEvents } from '@documenso/prisma/client';

export type GetAllWebhooksByEventTriggerOptions = {
  eventTrigger: WebhookTriggerEvents;
};

export const getAllWebhooksByEventTrigger = async ({
  eventTrigger,
}: GetAllWebhooksByEventTriggerOptions) => {
  return prisma.webhook.findMany({
    where: {
      eventTriggers: {
        has: eventTrigger,
      },
      enabled: true,
    },
  });
};
