import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';

import { authenticatedProcedure } from '../trpc';
import {
  ZBulkDeleteDocumentsRequestSchema,
  ZBulkDeleteDocumentsResponseSchema,
  bulkDeleteDocumentsMeta,
} from './bulk-delete-documents.types';

export const bulkDeleteDocumentsRoute = authenticatedProcedure
  .meta(bulkDeleteDocumentsMeta)
  .input(ZBulkDeleteDocumentsRequestSchema)
  .output(ZBulkDeleteDocumentsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { documentIds } = input;

    ctx.logger.info({
      input: {
        documentIds,
      },
    });

    let deletedCount = 0;
    const failedIds: number[] = [];

    // Delete documents one by one to ensure proper handling of:
    // - Soft delete for completed documents
    // - Hard delete for draft/pending documents
    // - Cancellation emails to recipients
    // - Webhooks
    // - Audit logs
    for (const documentId of documentIds) {
      try {
        await deleteDocument({
          id: {
            type: 'documentId',
            id: documentId,
          },
          userId: user.id,
          teamId,
          requestMetadata: ctx.metadata,
        });

        deletedCount++;
      } catch (err) {
        ctx.logger.warn(
          {
            documentId,
            error: err,
          },
          'Failed to delete document during bulk delete',
        );
        failedIds.push(documentId);
      }
    }

    return {
      deletedCount,
      failedIds,
    };
  });
