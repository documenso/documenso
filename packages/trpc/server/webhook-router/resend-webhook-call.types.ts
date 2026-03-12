import { z } from 'zod';

export const ZResendWebhookCallRequestSchema = z.object({
  webhookId: z.string(),
  webhookCallId: z.string(),
});

export type TResendWebhookRequest = z.infer<typeof ZResendWebhookCallRequestSchema>;
