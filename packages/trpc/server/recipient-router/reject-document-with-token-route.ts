import { z } from 'zod';

import { rejectDocumentWithToken } from '@documenso/lib/server-only/document/reject-document-with-token';
import { ZRecipientActionAuthSchema } from '@documenso/lib/types/document-auth';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { procedure } from '../trpc';

export const ZRejectDocumentWithTokenMutationSchema = z.object({
  token: z.string(),
  documentId: z.number(),
  reason: z.string(),
  authOptions: ZRecipientActionAuthSchema.optional(),
});

export const rejectDocumentWithTokenRoute = procedure
  .input(ZRejectDocumentWithTokenMutationSchema)
  .mutation(async ({ input, ctx }) => {
    const { token, documentId, reason } = input;

    return await rejectDocumentWithToken({
      token,
      documentId,
      reason,
      requestMetadata: extractNextApiRequestMetadata(ctx.req),
    });
  });
