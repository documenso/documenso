import { z } from 'zod';

import DocumentShareLinkSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentShareLinkSchema';

export const ZShareDocumentRequestSchema = z
  .object({
    documentId: z.number().optional(),
    envelopeId: z.string().optional(),
    token: z.string().optional(),
  })
  .refine((data) => data.documentId != null || data.envelopeId != null, {
    message: 'Either documentId or envelopeId is required',
    path: ['documentId'],
  });

export const ZShareDocumentResponseSchema = DocumentShareLinkSchema.pick({
  slug: true,
  email: true,
});

export type TShareDocumentRequest = z.infer<typeof ZShareDocumentRequestSchema>;
export type TShareDocumentResponse = z.infer<typeof ZShareDocumentResponseSchema>;
