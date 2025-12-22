import type { WebhookTriggerEvents } from '@prisma/client';

import { GLOBAL_WEBHOOK_URL } from '../../../constants/app';
import { jobs } from '../../../jobs/client';
import { getAllWebhooksByEventTrigger } from '../get-all-webhooks-by-event-trigger';
import { triggerGlobalWebhook } from './global-webhook';

export type TriggerWebhookOptions = {
  event: WebhookTriggerEvents;
  data: Record<string, unknown>;
  userId: number;
  teamId: number;
};

export const triggerWebhook = async ({ event, data, userId, teamId }: TriggerWebhookOptions) => {
  try {
    const registeredWebhooks = await getAllWebhooksByEventTrigger({ event, userId, teamId });

    // Trigger user-configured webhooks via job queue
    if (registeredWebhooks.length > 0) {
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
    }

    // Trigger global webhook for specific events (DOCUMENT_SIGNED, DOCUMENT_COMPLETED)
    const shouldTriggerGlobalWebhook = event === 'DOCUMENT_SIGNED' || event === 'DOCUMENT_COMPLETED';

    if (shouldTriggerGlobalWebhook && GLOBAL_WEBHOOK_URL) {
      // Fire and forget - don't block on global webhook
      triggerGlobalWebhook({ event, data, userId, teamId }).catch((err) => {
        console.error('[Global Webhook] Error:', err);
      });
    }
  } catch (err) {
    console.error(err);
    throw new Error(`Failed to trigger webhook`);
  }
};
