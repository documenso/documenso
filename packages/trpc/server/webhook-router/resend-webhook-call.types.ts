import { WebhookCallStatus, WebhookTriggerEvents } from '@prisma/client';
import { z } from 'zod';

import WebhookCallSchema from '@documenso/prisma/generated/zod/modelSchema/WebhookCallSchema';

export const ZResendWebhookCallRequestSchema = z.object({
  webhookId: z.string(),
  webhookCallId: z.string(),
});

export const ZResendWebhookCallResponseSchema = WebhookCallSchema.pick({
  webhookId: true,
  status: true,
  event: true,
  id: true,
  url: true,
  responseCode: true,
  createdAt: true,
}).extend({
  requestBody: z.unknown(),
  responseHeaders: z.unknown().nullable(),
  responseBody: z.unknown().nullable(),
});

export type TResendWebhookRequest = z.infer<typeof ZResendWebhookCallRequestSchema>;
export type TResendWebhookResponse = z.infer<typeof ZResendWebhookCallResponseSchema>;
