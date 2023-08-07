import { TRPCError } from '@trpc/server';

import { findDocumentsWithRecipientAndSender } from '@documenso/lib/server-only/document/find-documents';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { setRecipientsForDocument } from '@documenso/lib/server-only/recipient/set-recipients-for-document';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZSearchInboxDocumentsParamsSchema,
  ZSendDocumentMutationSchema,
  ZSetFieldsForDocumentMutationSchema,
  ZSetRecipientsForDocumentMutationSchema,
} from './schema';

export const documentRouter = router({
  searchInboxDocuments: authenticatedProcedure
    .input(ZSearchInboxDocumentsParamsSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { filter, query, cursor: page } = input;

        return await findDocumentsWithRecipientAndSender({
          email: ctx.session.email,
          query,
          signingStatus: filter,
          orderBy: {
            column: 'created',
            direction: 'desc',
          },
          page,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Something went wrong. Please try again later.',
        });
      }
    }),

  setRecipientsForDocument: authenticatedProcedure
    .input(ZSetRecipientsForDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { documentId, recipients } = input;

        return await setRecipientsForDocument({
          userId: ctx.user.id,
          documentId,
          recipients,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'We were unable to set the recipients for this document. Please try again later.',
        });
      }
    }),

  setFieldsForDocument: authenticatedProcedure
    .input(ZSetFieldsForDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { documentId, fields } = input;

        return await setFieldsForDocument({
          userId: ctx.user.id,
          documentId,
          fields,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to set the fields for this document. Please try again later.',
        });
      }
    }),

  sendDocument: authenticatedProcedure
    .input(ZSendDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { documentId } = input;

        return await sendDocument({
          userId: ctx.user.id,
          documentId,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to send this document. Please try again later.',
        });
      }
    }),
});
