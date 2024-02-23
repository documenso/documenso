import type { Document, WebhookTriggerEvents } from '@documenso/prisma/client';

import { getAllWebhooksByEventTrigger } from '../server-only/webhooks/get-all-webhooks-by-event-trigger';
import { postWebhookPayload } from './post-webhook-payload';

export type TriggerWebhookOptions = {
  eventTrigger: WebhookTriggerEvents;
  documentData: Document;
};

export const triggerWebhook = async ({ eventTrigger, documentData }: TriggerWebhookOptions) => {
  try {
    const allWebhooks = await getAllWebhooksByEventTrigger({ eventTrigger });

    const webhookPromises = allWebhooks.map((webhook) => {
      const { webhookUrl, secret } = webhook;

      postWebhookPayload({
        webhookData: { webhookUrl, secret, eventTriggers: [eventTrigger] },
        documentData,
      }).catch((_err) => {
        throw new Error(`Failed to send webhook to ${webhookUrl}`);
      });
    });

    return Promise.all(webhookPromises);
  } catch (err) {
    throw new Error(`Failed to trigger webhook`);
  }
};
