import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';
import { z } from 'zod';

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
  /**
   * The title of the parent envelope (document). Used to name downloads of
   * single-item envelopes after the document rather than the (potentially stale)
   * envelope item title.
   */
  envelopeTitle: z.string(),
});
