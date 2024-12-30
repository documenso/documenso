import { z } from 'zod';

import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { ZRecipientActionAuthSchema } from '@documenso/lib/types/document-auth';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { procedure } from '../trpc';

export const ZCompleteDocumentWithTokenRequestSchema = z.object({
  token: z.string(),
  documentId: z.number(),
  authOptions: ZRecipientActionAuthSchema.optional(),
});

export const completeDocumentWithTokenRoute = procedure
  .input(ZCompleteDocumentWithTokenRequestSchema)
  .mutation(async ({ input, ctx }) => {
    const { token, documentId, authOptions } = input;

    return await completeDocumentWithToken({
      token,
      documentId,
      authOptions,
      userId: ctx.user?.id,
      requestMetadata: extractNextApiRequestMetadata(ctx.req),
    });
  });
