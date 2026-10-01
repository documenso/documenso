import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const duplicateDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/duplicate',
    summary: 'Duplicate document',
    description:
      'Deprecated: this endpoint is being replaced by the Envelope API. See https://docs.documenso.com/docs/developers/api/migrate-to-envelopes for the migration guide.',
    tags: ['Document'],
    deprecated: true,
  },
};

export const ZDuplicateDocumentRequestSchema = z.object({
  documentId: z.number(),
});

export const ZDuplicateDocumentResponseSchema = z.object({
  id: z.string().describe('The envelope ID'),
  documentId: z.number().describe('The legacy document ID'),
});

export type TDuplicateDocumentRequest = z.infer<typeof ZDuplicateDocumentRequestSchema>;
export type TDuplicateDocumentResponse = z.infer<typeof ZDuplicateDocumentResponseSchema>;
