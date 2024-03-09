import { prisma } from '@documenso/prisma';
import {
  Prisma,
  type Webhook,
  WebhookCallStatus,
  type WebhookTriggerEvents,
} from '@documenso/prisma/client';

export type ExecuteWebhookOptions = {
  event: WebhookTriggerEvents;
  webhook: Webhook;
  data: unknown;
};

export const executeWebhook = async ({ event, webhook, data }: ExecuteWebhookOptions) => {
  const { webhookUrl: url, secret } = webhook;

  console.log('Executing webhook', { event, url });

  const payload = {
    event,
    payload: data,
    createdAt: new Date().toISOString(),
    webhookEndpoint: url,
  };

  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
      'X-Documenso-Secret': secret ?? '',
    },
  });

  const body = await response.text();

  let responseBody: Prisma.InputJsonValue | Prisma.JsonNullValueInput = Prisma.JsonNull;

  try {
    responseBody = JSON.parse(body);
  } catch (err) {
    responseBody = body;
  }

  await prisma.webhookCall.create({
    data: {
      url,
      event,
      status: response.ok ? WebhookCallStatus.SUCCESS : WebhookCallStatus.FAILED,
      requestBody: payload as Prisma.InputJsonValue,
      responseCode: response.status,
      responseBody,
      responseHeaders: Object.fromEntries(response.headers.entries()),
      webhookId: webhook.id,
    },
  });
};
