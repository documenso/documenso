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
   * The current title of the parent envelope (document).
   *
   * For a single-item envelope the item *is* the document, so the client uses this
   * as the download filename and displayed name. Item titles are frozen at creation
   * time and can go stale after a rename or when a document is generated from a
   * template, whereas the envelope title always reflects the current document title.
   *
   * Optional so cached / initial data that predates this field still satisfies the type.
   */
  envelopeTitle: z.string().optional(),
});
