import { z } from 'zod';

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
  data: EnvelopeItemSchema.pick({
    id: true,
    envelopeId: true,
    title: true,
    order: true,
  }).array(),
});
