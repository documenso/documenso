import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';
import type { TrpcRouteMeta } from '../trpc';

export const resendWebhookCallMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/webhook/call/resend',
    summary: 'Resend webhook call',
    description: 'Resend a failed webhook delivery',
    tags: ['Webhooks'],
  },
};

export const ZResendWebhookCallRequestSchema = z.object({
  webhookId: z.string(),
  webhookCallId: z.string(),
});

export const ZResendWebhookCallResponseSchema = ZSuccessResponseSchema;

export type TResendWebhookRequest = z.infer<typeof ZResendWebhookCallRequestSchema>;
export type TResendWebhookResponse = z.infer<typeof ZResendWebhookCallResponseSchema>;
