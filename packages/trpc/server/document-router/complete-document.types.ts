import { z } from 'zod';

import { ZDocumentLiteSchema } from '@documenso/lib/types/document';

import type { TrpcRouteMeta } from '../trpc';

export const completeDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/complete',
    summary: 'Complete document',
    description:
      'Finalize a pending document before all requested recipients have signed, sealing it with the signatures captured so far.',
    tags: ['Document'],
  },
};

export const ZCompleteDocumentRequestSchema = z.object({
  documentId: z.number().describe('The ID of the document to finalize.'),
});

export const ZCompleteDocumentResponseSchema = ZDocumentLiteSchema;

export type TCompleteDocumentRequest = z.infer<typeof ZCompleteDocumentRequestSchema>;
export type TCompleteDocumentResponse = z.infer<typeof ZCompleteDocumentResponseSchema>;
