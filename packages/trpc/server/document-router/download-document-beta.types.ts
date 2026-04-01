import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const downloadDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/document/{documentId}/download-beta',
    summary: 'Download document (beta)',
    description: 'Get a pre-signed download URL for the original or signed version of a document',
    tags: ['Document'],
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

export const ZDownloadDocumentResponseSchema = z.object({
  downloadUrl: z.string().describe('Pre-signed URL for downloading the PDF file'),
  filename: z.string().describe('The filename of the PDF file'),
  contentType: z.string().describe('MIME type of the file'),
});

export type TDownloadDocumentRequest = z.infer<typeof ZDownloadDocumentRequestSchema>;
export type TDownloadDocumentResponse = z.infer<typeof ZDownloadDocumentResponseSchema>;
