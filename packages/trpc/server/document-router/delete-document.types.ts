import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';
import type { TrpcRouteMeta } from '../trpc';

export const deleteDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/delete',
    summary: 'Delete document',
    tags: ['Document'],
  },
};

export const ZDeleteDocumentRequestSchema = z.object({
  documentId: z.number(),
});

export const ZDeleteDocumentResponseSchema = ZSuccessResponseSchema;

export type TDeleteDocumentRequest = z.infer<typeof ZDeleteDocumentRequestSchema>;
export type TDeleteDocumentResponse = z.infer<typeof ZDeleteDocumentResponseSchema>;
