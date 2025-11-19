import { DocumentSource, DocumentStatus } from '@prisma/client';
import { z } from 'zod';

import { ZDocumentManySchema } from '@doku-seal/lib/types/document';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@doku-seal/lib/types/search-params';

import type { TrpcRouteMeta } from '../trpc';

export const ZFindDocumentsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/document',
    summary: 'Find documents',
    description: 'Find documents based on a search criteria',
    tags: ['Document'],
  },
};

export const ZFindDocumentsRequestSchema = ZFindSearchParamsSchema.extend({
  templateId: z
    .number()
    .describe('Filter documents by the template ID used to create it.')
    .optional(),
  source: z
    .nativeEnum(DocumentSource)
    .describe('Filter documents by how it was created.')
    .optional(),
  status: z
    .nativeEnum(DocumentStatus)
    .describe('Filter documents by the current status')
    .optional(),
  folderId: z.string().describe('Filter documents by folder ID').optional(),
  orderByColumn: z.enum(['createdAt']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).describe('').default('desc'),
});

export const ZFindDocumentsResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentManySchema.array(),
});

export type TFindDocumentsRequest = z.infer<typeof ZFindDocumentsRequestSchema>;
export type TFindDocumentsResponse = z.infer<typeof ZFindDocumentsResponseSchema>;
