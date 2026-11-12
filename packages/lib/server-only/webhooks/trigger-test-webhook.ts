import type { WebhookTriggerEvents } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
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
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Webhook is disabled',
    });
  }

  if (!webhook.eventTriggers.includes(event)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Webhook does not support event: ${event}`,
    });
  }

  const samplePayload = generateSampleWebhookPayload(event, webhook.webhookUrl);

  await jobs.triggerJob({
    name: 'internal.execute-webhook',
    payload: {
      event,
      webhookId: webhook.id,
      data: samplePayload.payload,
    },
  });
};
