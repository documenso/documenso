import { z } from 'zod';
import { zfd } from 'zod-form-data';

import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';

import { zodFormData } from '../../utils/zod-form-data';

// export const replaceEnvelopeItemPdfMeta: TrpcRouteMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/envelope/item/replace', // Todo: replace or replace-pdf?
//     summary: 'Replace envelope item PDF',
//     contentTypes: ['multipart/form-data'],
//     description: 'Replace the PDF file of an existing envelope item',
//     tags: ['Envelope Items'],
//   },
// };

export const ZReplaceEnvelopeItemPdfPayloadSchema = z.object({
  envelopeId: z.string(),
  envelopeItemId: z.string(),
});

export const ZReplaceEnvelopeItemPdfRequestSchema = zodFormData({
  payload: zfd.json(ZReplaceEnvelopeItemPdfPayloadSchema),
  file: zfd.file(),
});

export const ZReplaceEnvelopeItemPdfResponseSchema = z.object({
  data: EnvelopeItemSchema.pick({
    id: true,
    title: true,
    envelopeId: true,
    order: true,
    documentDataId: true,
  }),
  deletedFieldIds: z.array(z.number()),
});

export type TReplaceEnvelopeItemPdfPayload = z.infer<typeof ZReplaceEnvelopeItemPdfPayloadSchema>;
export type TReplaceEnvelopeItemPdfRequest = z.infer<typeof ZReplaceEnvelopeItemPdfRequestSchema>;
export type TReplaceEnvelopeItemPdfResponse = z.infer<typeof ZReplaceEnvelopeItemPdfResponseSchema>;
