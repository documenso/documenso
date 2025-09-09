import { upsertDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';

import { authenticatedProcedure } from '../trpc';
import {
  ZDistributeDocumentRequestSchema,
  ZDistributeDocumentResponseSchema,
  distributeDocumentMeta,
} from './distribute-document.types';

export const distributeDocumentRoute = authenticatedProcedure
  .meta(distributeDocumentMeta)
  .input(ZDistributeDocumentRequestSchema)
  .output(ZDistributeDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { documentId, meta = {} } = input;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    if (Object.values(meta).length > 0) {
      await upsertDocumentMeta({
        userId: ctx.user.id,
        teamId,
        documentId,
        subject: meta.subject,
        message: meta.message,
        dateFormat: meta.dateFormat,
        timezone: meta.timezone,
        redirectUrl: meta.redirectUrl,
        distributionMethod: meta.distributionMethod,
        emailSettings: meta.emailSettings,
        language: meta.language,
        emailId: meta.emailId,
        emailReplyTo: meta.emailReplyTo,
        requestMetadata: ctx.metadata,
      });
    }

    return await sendDocument({
      userId: ctx.user.id,
      documentId,
      teamId,
      requestMetadata: ctx.metadata,
    });
  });
