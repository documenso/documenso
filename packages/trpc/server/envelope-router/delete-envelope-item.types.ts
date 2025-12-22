import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';
import type { TrpcRouteMeta } from '../trpc';

export const deleteEnvelopeItemMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/item/delete',
    summary: 'Delete envelope item',
    description: 'Delete an envelope item from an envelope',
    tags: ['Envelope Items'],
  },
};

export const ZDeleteEnvelopeItemRequestSchema = z.object({
  envelopeId: z.string(),
  envelopeItemId: z.string(),
});

export const ZDeleteEnvelopeItemResponseSchema = ZSuccessResponseSchema;

export type TDeleteEnvelopeItemRequest = z.infer<typeof ZDeleteEnvelopeItemRequestSchema>;
export type TDeleteEnvelopeItemResponse = z.infer<typeof ZDeleteEnvelopeItemResponseSchema>;
