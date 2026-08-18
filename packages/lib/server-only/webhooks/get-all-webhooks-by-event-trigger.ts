import { prisma } from '@documenso/prisma';
import type { WebhookTriggerEvents } from '@prisma/client';

import { buildTeamWhereQuery } from '../../utils/teams';

export type GetAllWebhooksByEventTriggerOptions = {
  event: WebhookTriggerEvents;
  /**
   * Scope through the user's current team membership (request contexts).
   * Internal jobs act on behalf of the system and must omit it: resolving
   * through the document author's membership breaks the moment their access
   * is revoked, silently disabling the team's webhooks (#3192).
   */
  userId?: number;
  teamId: number;
};

export const getAllWebhooksByEventTrigger = async ({ event, userId, teamId }: GetAllWebhooksByEventTriggerOptions) => {
  return prisma.webhook.findMany({
    where: {
      enabled: true,
      eventTriggers: {
        has: event,
      },
      team: userId !== undefined ? buildTeamWhereQuery({ teamId, userId }) : { id: teamId },
    },
  });
};
