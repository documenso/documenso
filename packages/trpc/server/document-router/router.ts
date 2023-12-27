import { TRPCError } from '@trpc/server';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { upsertDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { createDocument } from '@documenso/lib/server-only/document/create-document';
import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import { duplicateDocumentById } from '@documenso/lib/server-only/document/duplicate-document-by-id';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { resendDocument } from '@documenso/lib/server-only/document/resend-document';
import { searchDocumentsWithKeyword } from '@documenso/lib/server-only/document/search-documents-with-keyword';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { updateTitle } from '@documenso/lib/server-only/document/update-title';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { setRecipientsForDocument } from '@documenso/lib/server-only/recipient/set-recipients-for-document';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZCreateDocumentMutationSchema,
  ZDeleteDraftDocumentMutationSchema,
  ZGetDocumentByIdQuerySchema,
  ZGetDocumentByTokenQuerySchema,
  ZResendDocumentMutationSchema,
  ZSearchDocumentsMutationSchema,
  ZSendDocumentMutationSchema,
  ZSetFieldsForDocumentMutationSchema,
  ZSetRecipientsForDocumentMutationSchema,
  ZSetTitleForDocumentMutationSchema,
} from './schema';

export const documentRouter = router({
  getDocumentById: authenticatedProcedure
    .input(ZGetDocumentByIdQuerySchema)
    .query(async ({ input, ctx }) => {
      try {
        const { id } = input;

        return await getDocumentById({
          id,
          userId: ctx.user.id,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to find this document. Please try again later.',
        });
      }
    }),

  getDocumentByToken: procedure.input(ZGetDocumentByTokenQuerySchema).query(async ({ input }) => {
    try {
      const { token } = input;

      return await getDocumentAndSenderByToken({
        token,
      });
    } catch (err) {
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to find this document. Please try again later.',
      });
    }
  }),

  createDocument: authenticatedProcedure
    .input(ZCreateDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { title, documentDataId, teamId } = input;

        // Teams bypass document limits.
        if (teamId !== undefined) {
          const { remaining } = await getServerLimits({ email: ctx.user.email });

          if (remaining.documents <= 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'You have reached your document limit for this month. Please upgrade your plan.',
            });
          }
        }

        return await createDocument({
          userId: ctx.user.id,
          teamId,
          title,
          documentDataId,
        });
      } catch (err) {
        if (err instanceof TRPCError) {
          throw err;
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to create this document. Please try again later.',
        });
      }
    }),

  deleteDocument: authenticatedProcedure
    .input(ZDeleteDraftDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, status } = input;

        const userId = ctx.user.id;

        return await deleteDocument({ id, userId, status });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to delete this document. Please try again later.',
        });
      }
    }),

  setTitleForDocument: authenticatedProcedure
    .input(ZSetTitleForDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, title } = input;

      const userId = ctx.user.id;

      return await updateTitle({
        title,
        userId,
        documentId,
      });
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
        const { documentId, email } = input;

        if (email.message || email.subject) {
          await upsertDocumentMeta({
            documentId,
            subject: email.subject,
            message: email.message,
          });
        }

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

  resendDocument: authenticatedProcedure
    .input(ZResendDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { documentId, recipients } = input;

        return await resendDocument({
          userId: ctx.user.id,
          documentId,
          recipients,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to resend this document. Please try again later.',
        });
      }
    }),

  duplicateDocument: authenticatedProcedure
    .input(ZGetDocumentByIdQuerySchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id } = input;

        return await duplicateDocumentById({
          id,
          userId: ctx.user.id,
        });
      } catch (err) {
        console.log(err);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We are unable to duplicate this document. Please try again later.',
        });
      }
    }),

  searchDocuments: authenticatedProcedure
    .input(ZSearchDocumentsMutationSchema)
    .query(async ({ input, ctx }) => {
      const { query } = input;

      try {
        const documents = await searchDocumentsWithKeyword({
          query,
          userId: ctx.user.id,
        });
        return documents;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We are unable to search for documents. Please try again later.',
        });
      }
    }),
});
