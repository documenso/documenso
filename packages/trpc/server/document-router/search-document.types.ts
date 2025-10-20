import { z } from 'zod';

export const ZSearchDocumentRequestSchema = z.object({
  query: z.string(),
});

export const ZSearchDocumentResponseSchema = z
  .object({
    title: z.string(),
    path: z.string(),
    value: z.string(),
  })
  .array();

export type TSearchDocumentRequest = z.infer<typeof ZSearchDocumentRequestSchema>;
export type TSearchDocumentResponse = z.infer<typeof ZSearchDocumentResponseSchema>;
