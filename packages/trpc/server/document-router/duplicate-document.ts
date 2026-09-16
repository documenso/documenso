import { duplicateEnvelope } from '@documenso/lib/server-only/envelope/duplicate-envelope';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  duplicateDocumentMeta,
  ZDuplicateDocumentRequestSchema,
  ZDuplicateDocumentResponseSchema,
} from './duplicate-document.types';

export const duplicateDocumentRoute = authenticatedProcedure
  .meta(duplicateDocumentMeta)
  .input(ZDuplicateDocumentRequestSchema)
  .output(ZDuplicateDocumentResponseSchema)
  .use(twoFactorScope((input) => ({ document: input.documentId })))
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { documentId } = input;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const duplicatedEnvelope = await duplicateEnvelope({
      id: {
        type: 'documentId',
        id: documentId,
      },
      userId: user.id,
      teamId,
    });

    return {
      id: duplicatedEnvelope.id,
      documentId: duplicatedEnvelope.legacyId.id,
    };
  });
