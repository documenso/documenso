import DocumentShareLinkSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentShareLinkSchema';
import { z } from 'zod';

export const ZShareDocumentRequestSchema = z.object({
  documentId: z.number(),
  token: z.string().optional(),
});

export const ZShareDocumentResponseSchema = DocumentShareLinkSchema.pick({
  slug: true,
  email: true,
});

export type TShareDocumentRequest = z.infer<typeof ZShareDocumentRequestSchema>;
export type TShareDocumentResponse = z.infer<typeof ZShareDocumentResponseSchema>;
