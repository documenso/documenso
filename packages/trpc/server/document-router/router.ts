import { TRPCError } from '@trpc/server';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { createDocument } from '@documenso/lib/server-only/document/create-document';
import { deleteDraftDocument } from '@documenso/lib/server-only/document/delete-draft-document';
import { duplicateDocumentById } from '@documenso/lib/server-only/document/duplicate-document-by-id';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { setRecipientsForDocument } from '@documenso/lib/server-only/recipient/set-recipients-for-document';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZCreateDocumentMutationSchema,
  ZDeleteDraftDocumentMutationSchema,
  ZGetDocumentByIdQuerySchema,
  ZGetDocumentByTokenQuerySchema,
  ZSendDocumentMutationSchema,
  ZSetFieldsForDocumentMutationSchema,
  ZSetRecipientsForDocumentMutationSchema,
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
        const { title, documentDataId } = input;

        const { remaining } = await getServerLimits({ email: ctx.user.email });

        if (remaining.documents <= 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'You have reached your document limit for this month. Please upgrade your plan.',
          });
        }

        return await createDocument({
          userId: ctx.user.id,
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

  deleteDraftDocument: authenticatedProcedure
    .input(ZDeleteDraftDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id } = input;

        const userId = ctx.user.id;

        return await deleteDraftDocument({ id, userId });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to delete this document. Please try again later.',
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
});
