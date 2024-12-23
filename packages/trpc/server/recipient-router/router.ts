import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { rejectDocumentWithToken } from '@documenso/lib/server-only/document/reject-document-with-token';
import {
  ZGetRecipientByIdResponseSchema,
  getRecipientById,
} from '@documenso/lib/server-only/recipient/get-recipient-by-id';
import {
  ZSetRecipientsForDocumentResponseSchema,
  setRecipientsForDocument,
} from '@documenso/lib/server-only/recipient/set-recipients-for-document';
import {
  ZSetRecipientsForTemplateResponseSchema,
  setRecipientsForTemplate,
} from '@documenso/lib/server-only/recipient/set-recipients-for-template';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZAddSignersMutationSchema,
  ZAddTemplateSignersMutationSchema,
  ZCompleteDocumentWithTokenMutationSchema,
  ZGetRecipientQuerySchema,
  ZRejectDocumentWithTokenMutationSchema,
} from './schema';

export const recipientRouter = router({
  /**
   * @public
   */
  getRecipient: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/recipient/{recipientId}',
        summary: 'Get recipient',
        description:
          'Returns a single recipient. If you want to retrieve all the recipients for a document or template, use the "Get Document" or "Get Template" request.',
        tags: ['Recipients'],
      },
    })
    .input(ZGetRecipientQuerySchema)
    .output(ZGetRecipientByIdResponseSchema)
    .query(async ({ input, ctx }) => {
      const { recipientId, teamId } = input;

      return await getRecipientById({
        userId: ctx.user.id,
        teamId,
        recipientId,
      });
    }),

  /**
   * @public
   */
  addSigners: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/{documentId}/recipient/set',
        summary: 'Set document recipients',
        tags: ['Recipients'],
      },
    })
    .input(ZAddSignersMutationSchema)
    .output(ZSetRecipientsForDocumentResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId, signers } = input;

      return await setRecipientsForDocument({
        userId: ctx.user.id,
        documentId,
        teamId,
        recipients: signers.map((signer) => ({
          id: signer.nativeId,
          email: signer.email,
          name: signer.name,
          role: signer.role,
          signingOrder: signer.signingOrder,
          actionAuth: signer.actionAuth,
        })),
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  /**
   * @public
   */
  addTemplateSigners: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/template/{templateId}/recipient/set',
        summary: 'Set template recipients',
        tags: ['Recipients'],
      },
    })
    .input(ZAddTemplateSignersMutationSchema)
    .output(ZSetRecipientsForTemplateResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { templateId, signers, teamId } = input;

      return await setRecipientsForTemplate({
        userId: ctx.user.id,
        teamId,
        templateId,
        recipients: signers.map((signer) => ({
          id: signer.nativeId,
          email: signer.email,
          name: signer.name,
          role: signer.role,
          signingOrder: signer.signingOrder,
          actionAuth: signer.actionAuth,
        })),
      });
    }),

  /**
   * @private
   */
  completeDocumentWithToken: procedure
    .input(ZCompleteDocumentWithTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { token, documentId, authOptions } = input;

      return await completeDocumentWithToken({
        token,
        documentId,
        authOptions,
        userId: ctx.user?.id,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  /**
   * @private
   */
  rejectDocumentWithToken: procedure
    .input(ZRejectDocumentWithTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { token, documentId, reason } = input;

      return await rejectDocumentWithToken({
        token,
        documentId,
        reason,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),
});
