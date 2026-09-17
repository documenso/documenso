import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';
import type { TrpcRouteMeta } from '../trpc';

export const deleteDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/delete',
    summary: 'Delete document',
    description:
      'Deprecated: this endpoint is being replaced by the Envelope API. See https://docs.documenso.com/docs/developers/api/migrate-to-envelopes for the migration guide.',
    tags: ['Document'],
    deprecated: true,
  },
};

export const ZDeleteDocumentRequestSchema = z.object({
  documentId: z.number(),
});

export const ZDeleteDocumentResponseSchema = ZSuccessResponseSchema;

export type TDeleteDocumentRequest = z.infer<typeof ZDeleteDocumentRequestSchema>;
export type TDeleteDocumentResponse = z.infer<typeof ZDeleteDocumentResponseSchema>;
