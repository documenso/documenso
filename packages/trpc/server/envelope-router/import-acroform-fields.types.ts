import { z } from 'zod';

export const ZImportAcroFormFieldsRequestSchema = z.object({
  envelopeId: z.string(),
  envelopeItemId: z.string(),
  recipientId: z.number(),
});

export const ZImportAcroFormFieldsResponseSchema = z.object({
  fieldsCreated: z.number(),
});

export type TImportAcroFormFieldsRequest = z.infer<typeof ZImportAcroFormFieldsRequestSchema>;
export type TImportAcroFormFieldsResponse = z.infer<typeof ZImportAcroFormFieldsResponseSchema>;
