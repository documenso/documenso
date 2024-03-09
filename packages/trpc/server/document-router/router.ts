import { TRPCError } from '@trpc/server';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { upsertDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { createDocument } from '@documenso/lib/server-only/document/create-document';
import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import { duplicateDocumentById } from '@documenso/lib/server-only/document/duplicate-document-by-id';
import { findDocumentAuditLogs } from '@documenso/lib/server-only/document/find-document-audit-logs';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { resendDocument } from '@documenso/lib/server-only/document/resend-document';
import { searchDocumentsWithKeyword } from '@documenso/lib/server-only/document/search-documents-with-keyword';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { updateTitle } from '@documenso/lib/server-only/document/update-title';
import { symmetricEncrypt } from '@documenso/lib/universal/crypto';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZCreateDocumentMutationSchema,
  ZDeleteDraftDocumentMutationSchema as ZDeleteDocumentMutationSchema,
  ZFindDocumentAuditLogsQuerySchema,
  ZGetDocumentByIdQuerySchema,
  ZGetDocumentByTokenQuerySchema,
  ZResendDocumentMutationSchema,
  ZSearchDocumentsMutationSchema,
  ZSendDocumentMutationSchema,
  ZSetPasswordForDocumentMutationSchema,
  ZSetTitleForDocumentMutationSchema,
} from './schema';

export const documentRouter = router({
  getDocumentById: authenticatedProcedure
    .input(ZGetDocumentByIdQuerySchema)
    .query(async ({ input, ctx }) => {
      try {
        return await getDocumentById({
          ...input,
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

        const { remaining } = await getServerLimits({ email: ctx.user.email, teamId });

        if (remaining.documents <= 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'You have reached your document limit for this month. Please upgrade your plan.',
          });
        }

        return await createDocument({
          userId: ctx.user.id,
          teamId,
          title,
          documentDataId,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
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
    .input(ZDeleteDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, teamId } = input;

        const userId = ctx.user.id;

        return await deleteDocument({
          id,
          userId,
          teamId,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to delete this document. Please try again later.',
        });
      }
    }),

  findDocumentAuditLogs: authenticatedProcedure
    .input(ZFindDocumentAuditLogsQuerySchema)
    .query(async ({ input, ctx }) => {
      try {
        const { page, perPage, documentId, cursor, filterForRecentActivity, orderBy } = input;

        return await findDocumentAuditLogs({
          page,
          perPage,
          documentId,
          cursor,
          filterForRecentActivity,
          orderBy,
          userId: ctx.user.id,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to find audit logs for this document. Please try again later.',
        });
      }
    }),

  setTitleForDocument: authenticatedProcedure
    .input(ZSetTitleForDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId, title } = input;

      const userId = ctx.user.id;

      return await updateTitle({
        title,
        userId,
        teamId,
        documentId,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  setPasswordForDocument: authenticatedProcedure
    .input(ZSetPasswordForDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { documentId, password } = input;

        const key = DOCUMENSO_ENCRYPTION_KEY;

        if (!key) {
          throw new Error('Missing encryption key');
        }

        const securePassword = symmetricEncrypt({
          data: password,
          key,
        });

        await upsertDocumentMeta({
          documentId,
          password: securePassword,
          userId: ctx.user.id,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to set the password for this document. Please try again later.',
        });
      }
    }),

  sendDocument: authenticatedProcedure
    .input(ZSendDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { documentId, teamId, meta } = input;

        if (meta.message || meta.subject || meta.timezone || meta.dateFormat || meta.redirectUrl) {
          await upsertDocumentMeta({
            documentId,
            subject: meta.subject,
            message: meta.message,
            dateFormat: meta.dateFormat,
            timezone: meta.timezone,
            redirectUrl: meta.redirectUrl,
            userId: ctx.user.id,
            requestMetadata: extractNextApiRequestMetadata(ctx.req),
          });
        }

        return await sendDocument({
          userId: ctx.user.id,
          documentId,
          teamId,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
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
        return await resendDocument({
          userId: ctx.user.id,
          ...input,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
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
        return await duplicateDocumentById({
          userId: ctx.user.id,
          ...input,
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
