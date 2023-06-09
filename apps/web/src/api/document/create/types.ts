import { z } from 'zod';

export const ZCreateDocumentRequestSchema = z.object({
  file: z.instanceof(File),
});

export type TCreateDocumentRequestSchema = z.infer<typeof ZCreateDocumentRequestSchema>;

export const ZCreateDocumentResponseSchema = z
  .object({
    id: z.number(),
  })
  .or(
    z.object({
      error: z.string(),
    }),
  );

export type TCreateDocumentResponseSchema = z.infer<typeof ZCreateDocumentResponseSchema>;
