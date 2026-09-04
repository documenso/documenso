import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';
import { ZWebhookResponseSchema } from './webhook.types';

export const getTeamWebhooksMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/webhook',
    summary: 'Find webhooks',
    description: 'Find all webhooks for the API token team',
    tags: ['Webhooks'],
  },
};

export const ZGetTeamWebhooksRequestSchema = z.object({});

export const ZGetTeamWebhooksResponseSchema = z.array(ZWebhookResponseSchema);

export type TGetTeamWebhooksRequest = z.infer<typeof ZGetTeamWebhooksRequestSchema>;
export type TGetTeamWebhooksResponse = z.infer<typeof ZGetTeamWebhooksResponseSchema>;
