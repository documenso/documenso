import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const duplicateDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/duplicate',
    summary: 'Duplicate document',
    tags: ['Document'],
  },
};

export const ZDuplicateDocumentRequestSchema = z.object({
  documentId: z.number(),
});

export const ZDuplicateDocumentResponseSchema = z.object({
  documentId: z.number(),
});

export type TDuplicateDocumentRequest = z.infer<typeof ZDuplicateDocumentRequestSchema>;
export type TDuplicateDocumentResponse = z.infer<typeof ZDuplicateDocumentResponseSchema>;
