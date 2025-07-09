import type { WebhookTriggerEvents } from '@prisma/client';

import { getWebhookById } from './get-webhook-by-id';
import { generateSampleWebhookPayload } from './trigger/generate-sample-data';
import { triggerWebhook } from './trigger/trigger-webhook';

export type TriggerTestWebhookOptions = {
  id: string;
  event: WebhookTriggerEvents;
  userId: number;
  teamId: number;
};

export const triggerTestWebhook = async ({
  id,
  event,
  userId,
  teamId,
}: TriggerTestWebhookOptions) => {
  const webhook = await getWebhookById({ id, userId, teamId });

  if (!webhook.enabled) {
    throw new Error('Webhook is disabled');
  }

  if (!webhook.eventTriggers.includes(event)) {
    throw new Error(`Webhook does not support event: ${event}`);
  }

  const samplePayload = generateSampleWebhookPayload(event, webhook.webhookUrl);

  try {
    await triggerWebhook({
      event,
      data: samplePayload,
      userId,
      teamId,
    });

    return { success: true, message: 'Test webhook triggered successfully' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
