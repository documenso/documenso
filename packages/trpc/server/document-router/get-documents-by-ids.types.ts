import { z } from 'zod';

import { ZDocumentManySchema } from '@documenso/lib/types/document';

import type { TrpcRouteMeta } from '../trpc';

export const getDocumentsByIdsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/get-many',
    summary: 'Get multiple documents',
    description: 'Retrieve multiple documents by their IDs',
    tags: ['Document'],
  },
};

export const ZGetDocumentsByIdsRequestSchema = z.object({
  documentIds: z.array(z.number()).min(1),
});

export const ZGetDocumentsByIdsResponseSchema = z.object({
  data: z.array(ZDocumentManySchema),
});

export type TGetDocumentsByIdsRequest = z.infer<typeof ZGetDocumentsByIdsRequestSchema>;
export type TGetDocumentsByIdsResponse = z.infer<typeof ZGetDocumentsByIdsResponseSchema>;
