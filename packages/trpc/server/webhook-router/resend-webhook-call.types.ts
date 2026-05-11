import { z } from 'zod';

export const ZResendWebhookCallRequestSchema = z.object({
  webhookId: z.string(),
  webhookCallId: z.string(),
});

export const ZResendWebhookCallResponseSchema = z.void();

export type TResendWebhookRequest = z.infer<typeof ZResendWebhookCallRequestSchema>;
export type TResendWebhookResponse = z.infer<typeof ZResendWebhookCallResponseSchema>;
