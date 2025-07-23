import type { WebhookTriggerEvents } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type GetAllWebhooksByEventTriggerOptions = {
  event: WebhookTriggerEvents;
  userId: number;
  teamId: number;
};

export const getAllWebhooksByEventTrigger = async ({
  event,
  userId,
  teamId,
}: GetAllWebhooksByEventTriggerOptions) => {
  return prisma.webhook.findMany({
    where: {
      enabled: true,
      eventTriggers: {
        has: event,
      },
      team: buildTeamWhereQuery({
        teamId,
        userId,
      }),
    },
  });
};
