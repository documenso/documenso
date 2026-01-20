import { z } from 'zod';

import DocumentDataSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentDataSchema';
import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';

export const ZGetEnvelopeItemsRequestSchema = z.object({
  envelopeId: z.string(),
});

export const ZGetEnvelopeItemsResponseSchema = z.object({
  data: EnvelopeItemSchema.pick({
    id: true,
    title: true,
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
