import type { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';
import { ZGetWebhookByIdRequestSchema } from './schema';
import { ZWebhookResponseSchema } from './webhook.types';

export const getWebhookByIdMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/webhook/{id}',
    summary: 'Get webhook',
    description: 'Returns a webhook given an ID',
    tags: ['Webhooks'],
  },
};

export { ZGetWebhookByIdRequestSchema };

export const ZGetWebhookByIdResponseSchema = ZWebhookResponseSchema;

export type TGetWebhookByIdRequest = z.infer<typeof ZGetWebhookByIdRequestSchema>;
export type TGetWebhookByIdResponse = z.infer<typeof ZGetWebhookByIdResponseSchema>;
