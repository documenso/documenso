import type { Prisma } from '@prisma/client';
import { WebhookCallStatus } from '@prisma/client';

import { executeWebhookCall } from '@documenso/lib/server-only/webhooks/execute-webhook-call';
import { prisma } from '@documenso/prisma';

import type { JobRunIO } from '../../client/_internal/job';
import type { TExecuteWebhookJobDefinition } from './execute-webhook';

export const run = async ({
  payload,
  io: _io,
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

  const result = await executeWebhookCall({ url, body: payloadData, secret });

  await prisma.webhookCall.create({
    data: {
      url,
      event,
      status: result.success ? WebhookCallStatus.SUCCESS : WebhookCallStatus.FAILED,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      requestBody: payloadData as Prisma.InputJsonValue,
      responseCode: result.responseCode,
      responseBody: result.responseBody,
      responseHeaders: result.responseHeaders,
      webhookId: webhook.id,
    },
  });

  if (!result.success) {
    throw new Error(`Webhook execution failed with status ${result.responseCode}`);
  }

  return {
    success: true,
    status: result.responseCode,
  };
};
