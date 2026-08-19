import type { WebhookTriggerEvents } from '@prisma/client';
import { nanoid } from 'nanoid';

import { jobs } from '../../../jobs/client';
import { getAllWebhooksByEventTrigger } from '../get-all-webhooks-by-event-trigger';

export type TriggerWebhookOptions = {
  event: WebhookTriggerEvents;
  data: Record<string, unknown>;
  userId: number;
  teamId: number;
};

export const triggerWebhook = async ({ event, data, userId, teamId }: TriggerWebhookOptions) => {
  try {
    const registeredWebhooks = await getAllWebhooksByEventTrigger({ event, userId, teamId });

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
            // Minted per delivery and constant across retry attempts, so
            // consumers can deduplicate the retries the queue performs (#3204).
            deliveryId: nanoid(),
          },
        });
      }),
    );
  } catch (err) {
    console.error(err);
    throw new Error(`Failed to trigger webhook`);
  }
};
