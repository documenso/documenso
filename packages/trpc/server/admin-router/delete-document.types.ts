import { z } from 'zod';

export const ZDeleteDocumentRequestSchema = z.object({
  id: z.string(),
  reason: z.string(),
});

export const ZDeleteDocumentResponseSchema = z.void();

export type TDeleteDocumentRequest = z.infer<typeof ZDeleteDocumentRequestSchema>;
export type TDeleteDocumentResponse = z.infer<typeof ZDeleteDocumentResponseSchema>;
