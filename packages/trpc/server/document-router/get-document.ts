import { getDocumentWithDetailsById } from '@documenso/lib/server-only/document/get-document-with-details-by-id';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetDocumentRequestSchema,
  ZGetDocumentResponseSchema,
  getDocumentMeta,
} from './get-document.types';

export const getDocumentRoute = authenticatedProcedure
  .meta(getDocumentMeta)
  .input(ZGetDocumentRequestSchema)
  .output(ZGetDocumentResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { documentId } = input;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    return await getDocumentWithDetailsById({
      userId: user.id,
      teamId,
      documentId,
    });
  });
