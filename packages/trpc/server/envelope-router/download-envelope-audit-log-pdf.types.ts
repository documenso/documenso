import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const downloadEnvelopeAuditLogPdfMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/envelope/{envelopeId}/audit-log/download',
    summary: 'Download envelope audit log PDF',
    description: 'Download the audit log for a document as a PDF.',
    tags: ['Envelope'],
    responseHeaders: z.object({
      'Content-Type': z.literal('application/pdf'),
    }),
  },
};

export const ZDownloadEnvelopeAuditLogPdfRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope to download the audit log for.'),
});

export const ZDownloadEnvelopeAuditLogPdfResponseSchema = z.instanceof(Uint8Array);

export type TDownloadEnvelopeAuditLogPdfRequest = z.infer<typeof ZDownloadEnvelopeAuditLogPdfRequestSchema>;
export type TDownloadEnvelopeAuditLogPdfResponse = z.infer<typeof ZDownloadEnvelopeAuditLogPdfResponseSchema>;
