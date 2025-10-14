import { z } from 'zod';

import DocumentShareLinkSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentShareLinkSchema';

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
