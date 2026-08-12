import { ZDocumentSchema } from '@documenso/lib/types/document';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const getDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/document/{documentId}',
    summary: 'Get document',
    description:
      'Deprecated: this endpoint is being replaced by the Envelope API. See https://docs.documenso.com/docs/developers/api/migrate-to-envelopes for the migration guide. Returns a document given an ID',
    tags: ['Document'],
    deprecated: true,
  },
};

export const ZGetDocumentRequestSchema = z.object({
  documentId: z.number(),
});

export const ZGetDocumentResponseSchema = ZDocumentSchema;

export type TGetDocumentRequest = z.infer<typeof ZGetDocumentRequestSchema>;
export type TGetDocumentResponse = z.infer<typeof ZGetDocumentResponseSchema>;
