import { z } from 'zod';

import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';

import { ZDocumentTitleSchema } from '../document-router/schema';
import type { TrpcRouteMeta } from '../trpc';

export const updateEnvelopeItemsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/item/update-many',
    summary: 'Update envelope items',
    description: 'Update multiple envelope items for an envelope',
    tags: ['Envelope Items'],
  },
};

export const ZUpdateEnvelopeItemsRequestSchema = z.object({
  envelopeId: z.string(),
  data: z
    .object({
      envelopeItemId: z.string().describe('The ID of the envelope item to update.'),
      order: z.number().int().min(1).optional(),
      title: ZDocumentTitleSchema.optional(),
    })
    .array()
    .min(1),
});

export const ZUpdateEnvelopeItemsResponseSchema = z.object({
  data: EnvelopeItemSchema.pick({
    id: true,
    order: true,
    title: true,
    envelopeId: true,
  }).array(),
});

export type TUpdateEnvelopeItemsRequest = z.infer<typeof ZUpdateEnvelopeItemsRequestSchema>;
export type TUpdateEnvelopeItemsResponse = z.infer<typeof ZUpdateEnvelopeItemsResponseSchema>;
