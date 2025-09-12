import { z } from 'zod';

import DocumentDataSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentDataSchema';
import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';

import { ZDocumentTitleSchema } from '../document-router/schema';

export const ZCreateEnvelopeItemsRequestSchema = z.object({
  envelopeId: z.string(),
  items: z
    .object({
      title: ZDocumentTitleSchema,
      documentDataId: z.string(),
    })
    .array(),
});

export const ZCreateEnvelopeItemsResponseSchema = z.object({
  createdEnvelopeItems: EnvelopeItemSchema.pick({
    id: true,
    title: true,
    documentDataId: true,
    envelopeId: true,
    order: true,
  })
    .extend({
      documentData: DocumentDataSchema.pick({
        type: true,
        id: true,
        data: true,
        initialData: true,
      }),
    })
    .array(),
});

export type TCreateEnvelopeItemsRequest = z.infer<typeof ZCreateEnvelopeItemsRequestSchema>;
export type TCreateEnvelopeItemsResponse = z.infer<typeof ZCreateEnvelopeItemsResponseSchema>;
