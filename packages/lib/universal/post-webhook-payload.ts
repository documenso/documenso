import type { Document, Webhook } from '@documenso/prisma/client';

export type PostWebhookPayloadOptions = {
  webhookData: Pick<Webhook, 'webhookUrl' | 'secret' | 'eventTriggers'>;
  documentData: Document;
};

export const postWebhookPayload = async ({
  webhookData,
  documentData,
}: PostWebhookPayloadOptions) => {
  const { webhookUrl, secret } = webhookData;

  const payload = {
    event: webhookData.eventTriggers.toString(),
    createdAt: new Date().toISOString(),
    webhookEndpoint: webhookUrl,
    payload: documentData,
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
      'X-Documenso-Secret': secret ?? '',
    },
  });

  if (!response.ok) {
    throw new Error(`Webhook failed with the status code ${response.status}`);
  }

  return {
    status: response.status,
    statusText: response.statusText,
    message: 'Webhook sent successfully',
  };
};
