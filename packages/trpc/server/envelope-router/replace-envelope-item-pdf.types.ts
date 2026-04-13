import { z } from 'zod';
import { zfd } from 'zod-form-data';

import { ZEnvelopeFieldSchema } from '@documenso/lib/types/field';
import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';

import { zfdFile, zodFormData } from '../../utils/zod-form-data';
import { ZDocumentTitleSchema } from '../document-router/schema';

export const ZReplaceEnvelopeItemPdfPayloadSchema = z.object({
  envelopeId: z.string(),
  envelopeItemId: z.string(),
  title: ZDocumentTitleSchema.optional(),
});

export const ZReplaceEnvelopeItemPdfRequestSchema = zodFormData({
  payload: zfd.json(ZReplaceEnvelopeItemPdfPayloadSchema),
  file: zfdFile(),
});

export const ZReplaceEnvelopeItemPdfResponseSchema = z.object({
  data: EnvelopeItemSchema.pick({
    id: true,
    title: true,
    envelopeId: true,
    order: true,
    documentDataId: true,
  }),
  /**
   * The full list of fields for the envelope after the replacement.
   *
   * This is only populated if fields have been changed or deleted. It will
   * return undefined otherwise.
   *
   * Done this way to reduce number of queries.
   */
  fields: ZEnvelopeFieldSchema.array().optional(),
});

export type TReplaceEnvelopeItemPdfPayload = z.infer<typeof ZReplaceEnvelopeItemPdfPayloadSchema>;
export type TReplaceEnvelopeItemPdfRequest = z.infer<typeof ZReplaceEnvelopeItemPdfRequestSchema>;
export type TReplaceEnvelopeItemPdfResponse = z.infer<typeof ZReplaceEnvelopeItemPdfResponseSchema>;
