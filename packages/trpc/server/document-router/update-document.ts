import { updateEnvelope } from '@documenso/lib/server-only/envelope/update-envelope';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateDocumentRequestSchema,
  ZUpdateDocumentResponseSchema,
} from './update-document.types';
import { updateDocumentMeta as updateDocumentTrpcMeta } from './update-document.types';

/**
 * Public route.
 */
export const updateDocumentRoute = authenticatedProcedure
  .meta(updateDocumentTrpcMeta)
  .input(ZUpdateDocumentRequestSchema)
  .output(ZUpdateDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { documentId, data, meta = {} } = input;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const userId = ctx.user.id;

    const envelope = await updateEnvelope({
      userId,
      teamId,
      id: {
        type: 'documentId',
        id: documentId,
      },
      data,
      meta,
      requestMetadata: ctx.metadata,
    });

    const mappedDocument = {
      ...envelope,
      id: mapSecondaryIdToDocumentId(envelope.secondaryId),
      envelopeId: envelope.id,
    };

    return mappedDocument;
  });
