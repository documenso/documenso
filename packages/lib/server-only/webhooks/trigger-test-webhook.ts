import type { WebhookTriggerEvents } from '@prisma/client';

import { jobs } from '../../jobs/client';
import { getWebhookById } from './get-webhook-by-id';
import { generateSampleWebhookPayload } from './trigger/generate-sample-data';

export type TriggerTestWebhookOptions = {
  id: string;
  event: WebhookTriggerEvents;
  userId: number;
  teamId: number;
};

export const triggerTestWebhook = async ({ id, event, userId, teamId }: TriggerTestWebhookOptions) => {
  const webhook = await getWebhookById({ id, userId, teamId });

  if (!webhook.enabled) {
    throw new Error('Webhook is disabled');
  }

  if (!webhook.eventTriggers.includes(event)) {
    throw new Error(`Webhook does not support event: ${event}`);
  }

  const samplePayload = generateSampleWebhookPayload(event, webhook.webhookUrl);

  try {
    // Only deliver to the webhook being tested, not every webhook in the team
    // that is subscribed to this event.
    await jobs.triggerJob({
      name: 'internal.execute-webhook',
      payload: {
        event,
        webhookId: webhook.id,
        data: samplePayload.payload,
      },
    });

    return { success: true, message: 'Test webhook triggered successfully' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
