import { WebhookCallStatus, WebhookTriggerEvents } from '@prisma/client';
import { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import WebhookCallSchema from '@documenso/prisma/generated/zod/modelSchema/WebhookCallSchema';

export const ZFindWebhookCallsRequestSchema = ZFindSearchParamsSchema.extend({
  webhookId: z.string(),
  status: z.nativeEnum(WebhookCallStatus).optional(),
  events: z
    .array(z.nativeEnum(WebhookTriggerEvents))
    .optional()
    .refine((arr) => !arr || new Set(arr).size === arr.length, {
      message: 'Events must be unique',
    }),
});

export const ZFindWebhookCallsResponseSchema = ZFindResultResponse.extend({
  data: WebhookCallSchema.pick({
    webhookId: true,
    status: true,
    event: true,
    id: true,
    url: true,
    responseCode: true,
    createdAt: true,
  })
    .extend({
      requestBody: z.unknown(),
      responseHeaders: z.unknown().nullable(),
      responseBody: z.unknown().nullable(),
    })
    .array(),
});

export type TFindWebhookCallsRequest = z.infer<typeof ZFindWebhookCallsRequestSchema>;
export type TFindWebhookCallsResponse = z.infer<typeof ZFindWebhookCallsResponseSchema>;
