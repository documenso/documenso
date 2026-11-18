import { ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

import { zfdContentImageFile, zfdFile, zodFormData } from '../../utils/zod-form-data';
import { ZCreateEnvelopePayloadSchema, ZCreateEnvelopeResponseSchema } from '../envelope-router/create-envelope.types';

/**
 * Extend the create envelope route with contents since embeds set all the data at once.
 */
export const ZCreateEmbeddingEnvelopePayloadSchema = ZCreateEnvelopePayloadSchema.extend({
  contents: z
    .object({
      identifier: z
        .union([z.string(), z.number().int().min(0)])
        .describe('Either the filename or the zero-based index of the file that was uploaded to attach the content to.')
        .optional(),
      contentMeta: ZEnvelopeContentMetaSchema.describe('All the properties of the content being placed.'),
      imageIndex: z
        .number()
        .int()
        .min(0)
        .describe(
          'The index of the file in `contentImages` to show in the content. Only image contents can hold an image.',
        )
        .optional(),
    })
    .array()
    .optional(),
});

export const ZCreateEmbeddingEnvelopeRequestSchema = zodFormData({
  payload: zfd.json(ZCreateEmbeddingEnvelopePayloadSchema),
  files: zfd.repeatableOfType(zfdFile()),
  contentImages: zfd.repeatableOfType(zfdContentImageFile()),
});

export const ZCreateEmbeddingEnvelopeResponseSchema = ZCreateEnvelopeResponseSchema;

export type TCreateEmbeddingEnvelopePayload = z.infer<typeof ZCreateEmbeddingEnvelopePayloadSchema>;
export type TCreateEmbeddingEnvelopeRequest = z.infer<typeof ZCreateEmbeddingEnvelopeRequestSchema>;
