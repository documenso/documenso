import { duplicateDocument } from '@documenso/lib/server-only/document/duplicate-document-by-id';

import { authenticatedProcedure } from '../trpc';
import {
  ZDuplicateDocumentRequestSchema,
  ZDuplicateDocumentResponseSchema,
  duplicateDocumentMeta,
} from './duplicate-document.types';

export const duplicateDocumentRoute = authenticatedProcedure
  .meta(duplicateDocumentMeta)
  .input(ZDuplicateDocumentRequestSchema)
  .output(ZDuplicateDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { documentId } = input;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    return await duplicateDocument({
      userId: user.id,
      teamId,
      documentId,
    });
  });
