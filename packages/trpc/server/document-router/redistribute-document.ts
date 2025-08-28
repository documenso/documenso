import { resendDocument } from '@documenso/lib/server-only/document/resend-document';

import { authenticatedProcedure } from '../trpc';
import {
  ZRedistributeDocumentRequestSchema,
  ZRedistributeDocumentResponseSchema,
  redistributeDocumentMeta,
} from './redistribute-document.types';
import { ZGenericSuccessResponse } from './schema';

export const redistributeDocumentRoute = authenticatedProcedure
  .meta(redistributeDocumentMeta)
  .input(ZRedistributeDocumentRequestSchema)
  .output(ZRedistributeDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { documentId, recipients } = input;

    ctx.logger.info({
      input: {
        documentId,
        recipients,
      },
    });

    await resendDocument({
      userId: ctx.user.id,
      teamId,
      documentId,
      recipients,
      requestMetadata: ctx.metadata,
    });

    return ZGenericSuccessResponse;
  });
