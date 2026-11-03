import { ZEnvelopeFieldSchema } from '@documenso/lib/types/field';
import { z } from 'zod';

export const ZImportAcroFormFieldsRequestSchema = z.object({
  envelopeId: z.string(),
});

export const ZImportAcroFormFieldsResponseSchema = z.object({
  itemsProcessed: z.number().int().min(0),
  fieldsCreated: z.number().int().min(0),
  unsupportedCount: z.number().int().min(0),
  signedSignatureCount: z.number().int().min(0),
  skippedItems: z.array(
    z.object({
      envelopeItemId: z.string(),
      envelopeItemTitle: z.string(),
      reason: z.enum(['encrypted', 'xfa-hybrid', 'no-form', 'error']),
    }),
  ),
  fields: z.array(ZEnvelopeFieldSchema),
});

export type TImportAcroFormFieldsRequest = z.infer<typeof ZImportAcroFormFieldsRequestSchema>;
export type TImportAcroFormFieldsResponse = z.infer<typeof ZImportAcroFormFieldsResponseSchema>;
