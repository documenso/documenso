import { upsertDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { updateDocument } from '@documenso/lib/server-only/document/update-document';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateDocumentRequestSchema,
  ZUpdateDocumentResponseSchema,
} from './update-document.types';
import { updateDocumentMeta } from './update-document.types';

/**
 * Public route.
 */
export const updateDocumentRoute = authenticatedProcedure
  .meta(updateDocumentMeta)
  .input(ZUpdateDocumentRequestSchema)
  .output(ZUpdateDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { documentId, data, meta = {} } = input;

    const userId = ctx.user.id;

    if (Object.values(meta).length > 0) {
      await upsertDocumentMeta({
        userId: ctx.user.id,
        teamId,
        documentId,
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
        emailSettings: meta.emailSettings,
        requestMetadata: ctx.metadata,
      });
    }

    return await updateDocument({
      userId,
      teamId,
      documentId,
      data,
      requestMetadata: ctx.metadata,
    });
  });
