import { z } from 'zod';

export const ZDownloadDocumentCertificateRequestSchema = z.object({
  documentId: z.number(),
});

export const ZDownloadDocumentCertificateResponseSchema = z.object({
  url: z.string(),
});

export type TDownloadDocumentCertificateRequest = z.infer<
  typeof ZDownloadDocumentCertificateRequestSchema
>;
export type TDownloadDocumentCertificateResponse = z.infer<
  typeof ZDownloadDocumentCertificateResponseSchema
>;
