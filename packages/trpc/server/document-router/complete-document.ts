import { completeDocumentEarly } from '@documenso/lib/server-only/document/complete-document-early';
import { mapEnvelopeToDocumentLite } from '@documenso/lib/utils/document';

import { authenticatedProcedure } from '../trpc';
import {
  ZCompleteDocumentRequestSchema,
  ZCompleteDocumentResponseSchema,
  completeDocumentMeta,
} from './complete-document.types';

export const completeDocumentRoute = authenticatedProcedure
  .meta(completeDocumentMeta)
  .input(ZCompleteDocumentRequestSchema)
  .output(ZCompleteDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { documentId } = input;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const envelope = await completeDocumentEarly({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      requestMetadata: ctx.metadata,
    });

    return mapEnvelopeToDocumentLite(envelope);
  });
