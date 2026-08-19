import { prisma } from '@documenso/prisma';
import type { WebhookTriggerEvents } from '@prisma/client';

export type GetAllWebhooksByEventTriggerOptions = {
  event: WebhookTriggerEvents;
  teamId: number;
};

/**
 * Find every enabled webhook a team has registered for a given event.
 *
 * This is a SYSTEM lookup, run when an event fires (e.g. a document is sealed
 * in a background job) to decide which webhooks to deliver. It is intentionally
 * scoped by `teamId` ALONE: webhooks belong to a team (`Webhook.teamId` is a
 * required column) and a domain event belongs to a team, so team identity is
 * the only thing that decides delivery.
 *
 * It must NOT be narrowed by the document owner's org-group membership (the
 * `buildTeamWhereQuery` user-membership join that the settings-list query
 * `getWebhooksByTeamId` uses). That join answers an authorization question —
 * "may this logged-in user see this team's webhooks" — which is meaningless
 * here: the "user" attached to a completion event is the document's owner,
 * which may be the organisation owner (for team-scoped API tokens, see
 * get-api-token-by-token.ts), a member who has since left the team, or a
 * self-host whose org-group rows were never backfilled. In every such case the
 * join matches nothing and the event is dropped silently — which is why
 * API-created documents never delivered `document.completed`.
 */
export const getAllWebhooksByEventTrigger = async ({
  event,
  teamId,
}: GetAllWebhooksByEventTriggerOptions) => {
  return await prisma.webhook.findMany({
    where: {
      enabled: true,
      eventTriggers: {
        has: event,
      },
      teamId,
    },
  });
};
