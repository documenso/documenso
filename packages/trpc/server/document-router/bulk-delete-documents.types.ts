import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const bulkDeleteDocumentsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/bulk-delete',
    summary: 'Bulk delete documents',
    description:
      'Delete multiple documents. Completed documents are soft-deleted, others are hard-deleted.',
    tags: ['Documents'],
  },
};

export const ZBulkDeleteDocumentsRequestSchema = z.object({
  documentIds: z.array(z.number()).min(1).max(100),
});

export const ZBulkDeleteDocumentsResponseSchema = z.object({
  deletedCount: z.number(),
  failedIds: z.array(z.number()),
});

export type TBulkDeleteDocumentsRequest = z.infer<typeof ZBulkDeleteDocumentsRequestSchema>;
export type TBulkDeleteDocumentsResponse = z.infer<typeof ZBulkDeleteDocumentsResponseSchema>;
