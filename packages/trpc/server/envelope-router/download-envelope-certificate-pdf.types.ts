import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const downloadEnvelopeCertificatePdfMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/envelope/{envelopeId}/certificate/download',
    summary: 'Download envelope certificate PDF',
    description: 'Download the signing certificate for a completed document as a PDF.',
    tags: ['Envelope'],
    responseHeaders: z.object({
      'Content-Type': z.literal('application/pdf'),
    }),
  },
};

export const ZDownloadEnvelopeCertificatePdfRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope to download the certificate for.'),
});

export const ZDownloadEnvelopeCertificatePdfResponseSchema = z.instanceof(Uint8Array);

export type TDownloadEnvelopeCertificatePdfRequest = z.infer<typeof ZDownloadEnvelopeCertificatePdfRequestSchema>;
export type TDownloadEnvelopeCertificatePdfResponse = z.infer<typeof ZDownloadEnvelopeCertificatePdfResponseSchema>;
