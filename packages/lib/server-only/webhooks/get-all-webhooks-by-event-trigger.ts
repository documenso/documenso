import { prisma } from '@documenso/prisma';
import type { WebhookTriggerEvents } from '@documenso/prisma/client';

export type GetAllWebhooksByEventTriggerOptions = {
  event: WebhookTriggerEvents;
  userId: number;
  teamId?: number;
};

export const getAllWebhooksByEventTrigger = async ({
  event,
  userId,
  teamId,
}: GetAllWebhooksByEventTriggerOptions) => {
  return prisma.webhook.findMany({
    where: {
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
      eventTriggers: {
        has: event,
      },
      enabled: true,
    },
  });
};
