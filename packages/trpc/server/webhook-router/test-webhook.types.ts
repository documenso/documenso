import { WebhookTriggerEvents } from '@prisma/client';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const testWebhookMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/webhook/test',
    summary: 'Test webhook',
    description: 'Send a test webhook payload for a subscribed event',
    tags: ['Webhooks'],
  },
};

export const ZTestWebhookRequestSchema = z.object({
  id: z.string(),
  event: z.nativeEnum(WebhookTriggerEvents),
});

export const ZTestWebhookResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type TTestWebhookRequest = z.infer<typeof ZTestWebhookRequestSchema>;
export type TTestWebhookResponse = z.infer<typeof ZTestWebhookResponseSchema>;
