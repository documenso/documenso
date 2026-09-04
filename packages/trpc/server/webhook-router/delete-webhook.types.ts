import type { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';
import { ZDeleteWebhookRequestSchema } from './schema';
import { ZWebhookResponseSchema } from './webhook.types';

export const deleteWebhookMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/webhook/delete',
    summary: 'Delete webhook',
    description: 'Delete a webhook subscription',
    tags: ['Webhooks'],
  },
};

export { ZDeleteWebhookRequestSchema };

export const ZDeleteWebhookResponseSchema = ZWebhookResponseSchema;

export type TDeleteWebhookRequest = z.infer<typeof ZDeleteWebhookRequestSchema>;
export type TDeleteWebhookResponse = z.infer<typeof ZDeleteWebhookResponseSchema>;
