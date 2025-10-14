import { z } from 'zod';

import { ZDocumentSchema } from '@documenso/lib/types/document';

import type { TrpcRouteMeta } from '../trpc';

export const getDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/document/{documentId}',
    summary: 'Get document',
    description: 'Returns a document given an ID',
    tags: ['Document'],
  },
};

export const ZGetDocumentRequestSchema = z.object({
  documentId: z.number(),
});

export const ZGetDocumentResponseSchema = ZDocumentSchema;

export type TGetDocumentRequest = z.infer<typeof ZGetDocumentRequestSchema>;
export type TGetDocumentResponse = z.infer<typeof ZGetDocumentResponseSchema>;
