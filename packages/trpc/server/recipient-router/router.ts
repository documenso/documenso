import { TRPCError } from '@trpc/server';

import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { setRecipientsForDocument } from '@documenso/lib/server-only/recipient/set-recipients-for-document';
import { setRecipientsForTemplate } from '@documenso/lib/server-only/recipient/set-recipients-for-template';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZAddSignersMutationSchema,
  ZAddTemplateSignersMutationSchema,
  ZCompleteDocumentWithTokenMutationSchema,
} from './schema';

export const recipientRouter = router({
  addSigners: authenticatedProcedure
    .input(ZAddSignersMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
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
            actionAuth: signer.actionAuth,
          })),
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to set this field. Please try again later.',
        });
      }
    }),

  addTemplateSigners: authenticatedProcedure
    .input(ZAddTemplateSignersMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
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
            actionAuth: signer.actionAuth,
          })),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to set this field. Please try again later.',
        });
      }
    }),

  completeDocumentWithToken: procedure
    .input(ZCompleteDocumentWithTokenMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { token, documentId, authOptions } = input;

        return await completeDocumentWithToken({
          token,
          documentId,
          authOptions,
          userId: ctx.user?.id,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to sign this field. Please try again later.',
        });
      }
    }),
});
