import { z } from 'zod';

import DocumentDataSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentDataSchema';
import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';

export const ZGetEnvelopeItemsByTokenRequestSchema = z.object({
  envelopeId: z.string(),
  access: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('recipient'),
      token: z.string(),
    }),
    z.object({
      type: z.literal('user'),
    }),
  ]),
});

export const ZGetEnvelopeItemsByTokenResponseSchema = z.object({
  envelopeItems: EnvelopeItemSchema.pick({
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
