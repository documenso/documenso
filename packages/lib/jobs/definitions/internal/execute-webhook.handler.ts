import { Prisma, WebhookCallStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import type { JobRunIO } from '../../client/_internal/job';
import type { TExecuteWebhookJobDefinition } from './execute-webhook';

export const run = async ({
  payload,
  io,
}: {
  payload: TExecuteWebhookJobDefinition;
  io: JobRunIO;
}) => {
  const { event, webhookId, data } = payload;

  const webhook = await prisma.webhook.findUniqueOrThrow({
    where: {
      id: webhookId,
    },
  });

  const { webhookUrl: url, secret } = webhook;

  const payloadData = {
    event,
    payload: data,
    createdAt: new Date().toISOString(),
    webhookEndpoint: url,
  };

  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payloadData),
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
      requestBody: payloadData as Prisma.InputJsonValue,
      responseCode: response.status,
      responseBody,
      responseHeaders: Object.fromEntries(response.headers.entries()),
      webhookId: webhook.id,
    },
  });

  if (!response.ok) {
    throw new Error(`Webhook execution failed with status ${response.status}`);
  }

  return {
    success: response.ok,
    status: response.status,
  };
};
