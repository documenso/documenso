import type { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';
import { ZEditWebhookRequestSchema } from './schema';
import { ZWebhookResponseSchema } from './webhook.types';

export const editWebhookMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/webhook/update',
    summary: 'Update webhook',
    description: 'Update an existing webhook subscription',
    tags: ['Webhooks'],
  },
};

export { ZEditWebhookRequestSchema };

export const ZEditWebhookResponseSchema = ZWebhookResponseSchema;

export type TEditWebhookRequest = z.infer<typeof ZEditWebhookRequestSchema>;
export type TEditWebhookResponse = z.infer<typeof ZEditWebhookResponseSchema>;
