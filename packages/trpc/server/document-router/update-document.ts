import { updateDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { updateDocument } from '@documenso/lib/server-only/document/update-document';
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

    if (Object.values(meta).length > 0) {
      await updateDocumentMeta({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'documentId',
          id: documentId,
        },
        subject: meta.subject,
        message: meta.message,
        timezone: meta.timezone,
        dateFormat: meta.dateFormat,
        language: meta.language,
        typedSignatureEnabled: meta.typedSignatureEnabled,
        uploadSignatureEnabled: meta.uploadSignatureEnabled,
        drawSignatureEnabled: meta.drawSignatureEnabled,
        redirectUrl: meta.redirectUrl,
        distributionMethod: meta.distributionMethod,
        signingOrder: meta.signingOrder,
        allowDictateNextSigner: meta.allowDictateNextSigner,
        emailId: meta.emailId,
        emailReplyTo: meta.emailReplyTo,
        emailSettings: meta.emailSettings,
        requestMetadata: ctx.metadata,
      });
    }

    const envelope = await updateDocument({
      userId,
      teamId,
      documentId,
      data,
      requestMetadata: ctx.metadata,
    });

    const mappedDocument = {
      ...envelope,
      id: mapSecondaryIdToDocumentId(envelope.secondaryId),
    };

    return mappedDocument;
  });
