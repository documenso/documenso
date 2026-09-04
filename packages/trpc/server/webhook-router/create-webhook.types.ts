import type { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';
import { ZCreateWebhookRequestSchema } from './schema';
import { ZWebhookResponseSchema } from './webhook.types';

export const createWebhookMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/webhook/create',
    summary: 'Create webhook',
    description: 'Create a webhook subscription for the API token team',
    tags: ['Webhooks'],
  },
};

export { ZCreateWebhookRequestSchema };

export const ZCreateWebhookResponseSchema = ZWebhookResponseSchema;

export type TCreateWebhookRequest = z.infer<typeof ZCreateWebhookRequestSchema>;
export type TCreateWebhookResponse = z.infer<typeof ZCreateWebhookResponseSchema>;
