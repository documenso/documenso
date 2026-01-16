import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const bulkMoveDocumentsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/bulk-move',
    summary: 'Bulk move documents to folder',
    description: 'Move multiple documents to a specified folder',
    tags: ['Documents'],
  },
};

export const ZBulkMoveDocumentsRequestSchema = z.object({
  documentIds: z.array(z.number()).min(1).max(100),
  folderId: z.string().nullable(),
});

export const ZBulkMoveDocumentsResponseSchema = z.object({
  movedCount: z.number(),
});

export type TBulkMoveDocumentsRequest = z.infer<typeof ZBulkMoveDocumentsRequestSchema>;
export type TBulkMoveDocumentsResponse = z.infer<typeof ZBulkMoveDocumentsResponseSchema>;
