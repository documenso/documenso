import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';
import type { TrpcRouteMeta } from '../trpc';

export const redistributeDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/redistribute',
    summary: 'Redistribute document',
    description:
      'Redistribute the document to the provided recipients who have not actioned the document. Will use the distribution method set in the document',
    tags: ['Document'],
  },
};

export const ZRedistributeDocumentRequestSchema = z.object({
  documentId: z.number(),
  recipients: z
    .array(z.number())
    .min(1)
    .describe('The IDs of the recipients to redistribute the document to.'),
});

export const ZRedistributeDocumentResponseSchema = ZSuccessResponseSchema;

export type TRedistributeDocumentRequest = z.infer<typeof ZRedistributeDocumentRequestSchema>;
export type TRedistributeDocumentResponse = z.infer<typeof ZRedistributeDocumentResponseSchema>;
