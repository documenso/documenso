import type { WebhookTriggerEvents } from '@prisma/client';

import { jobs } from '../../../jobs/client';
import { getAllWebhooksByEventTrigger } from '../get-all-webhooks-by-event-trigger';

export type TriggerWebhookOptions = {
  event: WebhookTriggerEvents;
  data: Record<string, unknown>;
  /**
   * Retained for caller compatibility and context, but NOT used to scope the
   * lookup: webhooks are delivered to every enabled webhook on `teamId` for the
   * event, regardless of which user owns the triggering resource. See
   * get-all-webhooks-by-event-trigger.ts for why.
   */
  userId: number;
  teamId: number;
};

export const triggerWebhook = async ({ event, data, teamId }: TriggerWebhookOptions) => {
  try {
    const registeredWebhooks = await getAllWebhooksByEventTrigger({ event, teamId });

    if (registeredWebhooks.length === 0) {
      return;
    }

    await Promise.allSettled(
      registeredWebhooks.map(async (webhook) => {
        await jobs.triggerJob({
          name: 'internal.execute-webhook',
          payload: {
            event,
            webhookId: webhook.id,
            data,
          },
        });
      }),
    );
  } catch (err) {
    console.error(err);
    throw new Error(`Failed to trigger webhook`);
  }
};
