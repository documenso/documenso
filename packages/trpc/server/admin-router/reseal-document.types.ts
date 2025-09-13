import { z } from 'zod';

export const ZResealDocumentRequestSchema = z.object({
  id: z.string(),
});

export const ZResealDocumentResponseSchema = z.void();

export type TResealDocumentRequest = z.infer<typeof ZResealDocumentRequestSchema>;
export type TResealDocumentResponse = z.infer<typeof ZResealDocumentResponseSchema>;
