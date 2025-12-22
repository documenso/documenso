import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';

import { ZGenericSuccessResponse } from '../schema';
import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteDocumentRequestSchema,
  ZDeleteDocumentResponseSchema,
  deleteDocumentMeta,
} from './delete-document.types';

export const deleteDocumentRoute = authenticatedProcedure
  .meta(deleteDocumentMeta)
  .input(ZDeleteDocumentRequestSchema)
  .output(ZDeleteDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { documentId } = input;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const userId = ctx.user.id;

    await deleteDocument({
      id: {
        type: 'documentId',
        id: documentId,
      },
      userId,
      teamId,
      requestMetadata: ctx.metadata,
    });

    return ZGenericSuccessResponse;
  });
