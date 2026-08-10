import { z } from 'zod';

export const ZDownloadDocumentCertificateRequestSchema = z.object({
  envelopeId: z.string(),
});

export const ZDownloadDocumentCertificateResponseSchema = z.object({
  data: z.string(),
  envelopeTitle: z.string(),
});

export type TDownloadDocumentCertificateRequest = z.infer<typeof ZDownloadDocumentCertificateRequestSchema>;
export type TDownloadDocumentCertificateResponse = z.infer<typeof ZDownloadDocumentCertificateResponseSchema>;
