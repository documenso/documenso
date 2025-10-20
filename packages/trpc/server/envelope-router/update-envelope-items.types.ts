import { z } from 'zod';

import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';

import { ZDocumentTitleSchema } from '../document-router/schema';

export const ZUpdateEnvelopeItemsRequestSchema = z.object({
  envelopeId: z.string(),
  data: z
    .object({
      envelopeItemId: z.string(),
      order: z.number().int().min(1).optional(),
      title: ZDocumentTitleSchema.optional(),
    })
    .array()
    .min(1),
});

export const ZUpdateEnvelopeItemsResponseSchema = z.object({
  updatedEnvelopeItems: EnvelopeItemSchema.pick({
    id: true,
    order: true,
    title: true,
    envelopeId: true,
  }).array(),
});

export type TUpdateEnvelopeItemsRequest = z.infer<typeof ZUpdateEnvelopeItemsRequestSchema>;
export type TUpdateEnvelopeItemsResponse = z.infer<typeof ZUpdateEnvelopeItemsResponseSchema>;
