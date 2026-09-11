import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const downloadDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/document/{documentId}/download',
    summary: 'Download document',
    description:
      'Deprecated: this endpoint is being replaced by the Envelope API. See https://docs.documenso.com/docs/developers/api/migrate-to-envelopes for the migration guide.',
    tags: ['Document'],
    deprecated: true,
    responseHeaders: z.object({
      'Content-Type': z.literal('application/pdf'),
    }),
  },
};

export const ZDownloadDocumentRequestSchema = z.object({
  documentId: z.number().describe('The ID of the document to download.'),
  version: z
    .enum(['original', 'signed'])
    .describe(
      'The version of the document to download. "signed" returns the completed document with signatures, "original" returns the original uploaded document.',
    )
    .default('signed'),
});

export const ZDownloadDocumentResponseSchema = z.instanceof(Uint8Array);

export type TDownloadDocumentRequest = z.infer<typeof ZDownloadDocumentRequestSchema>;
export type TDownloadDocumentResponse = z.infer<typeof ZDownloadDocumentResponseSchema>;
