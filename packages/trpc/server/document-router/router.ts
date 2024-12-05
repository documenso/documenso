import { TRPCError } from '@trpc/server';
import { DateTime } from 'luxon';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { AppError } from '@documenso/lib/errors/app-error';
import { encryptSecondaryData } from '@documenso/lib/server-only/crypto/encrypt';
import { upsertDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { createDocument } from '@documenso/lib/server-only/document/create-document';
import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import { duplicateDocumentById } from '@documenso/lib/server-only/document/duplicate-document-by-id';
import { findDocumentAuditLogs } from '@documenso/lib/server-only/document/find-document-audit-logs';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { getDocumentWithDetailsById } from '@documenso/lib/server-only/document/get-document-with-details-by-id';
import { moveDocumentToTeam } from '@documenso/lib/server-only/document/move-document-to-team';
import { resendDocument } from '@documenso/lib/server-only/document/resend-document';
import { searchDocumentsWithKeyword } from '@documenso/lib/server-only/document/search-documents-with-keyword';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { updateDocumentSettings } from '@documenso/lib/server-only/document/update-document-settings';
import { updateTitle } from '@documenso/lib/server-only/document/update-title';
import { symmetricEncrypt } from '@documenso/lib/universal/crypto';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { DocumentStatus } from '@documenso/prisma/client';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZCreateDocumentMutationSchema,
  ZDeleteDraftDocumentMutationSchema as ZDeleteDocumentMutationSchema,
  ZDownloadAuditLogsMutationSchema,
  ZDownloadCertificateMutationSchema,
  ZFindDocumentAuditLogsQuerySchema,
  ZFindDocumentsQuerySchema,
  ZGetDocumentByIdQuerySchema,
  ZGetDocumentByTokenQuerySchema,
  ZGetDocumentWithDetailsByIdQuerySchema,
  ZMoveDocumentsToTeamSchema,
  ZResendDocumentMutationSchema,
  ZSearchDocumentsMutationSchema,
  ZSendDocumentMutationSchema,
  ZSetPasswordForDocumentMutationSchema,
  ZSetSettingsForDocumentMutationSchema,
  ZSetSigningOrderForDocumentMutationSchema,
  ZSetTitleForDocumentMutationSchema,
  ZUpdateTypedSignatureSettingsMutationSchema,
} from './schema';

export const documentRouter = router({
  getDocumentById: authenticatedProcedure
    .input(ZGetDocumentByIdQuerySchema)
    .query(async ({ input, ctx }) => {
      return await getDocumentById({
        ...input,
        userId: ctx.user.id,
      });
    }),

  getDocumentByToken: procedure
    .input(ZGetDocumentByTokenQuerySchema)
    .query(async ({ input, ctx }) => {
      const { token } = input;

      return await getDocumentAndSenderByToken({
        token,
        userId: ctx.user?.id,
      });
    }),

  getDocumentWithDetailsById: authenticatedProcedure
    .input(ZGetDocumentWithDetailsByIdQuerySchema)
    .query(async ({ input, ctx }) => {
      return await getDocumentWithDetailsById({
        ...input,
        userId: ctx.user.id,
      });
    }),

  createDocument: authenticatedProcedure
    .input(ZCreateDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { title, documentDataId, teamId } = input;

      const { remaining } = await getServerLimits({ email: ctx.user.email, teamId });

      if (remaining.documents <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You have reached your document limit for this month. Please upgrade your plan.',
        });
      }

      return await createDocument({
        userId: ctx.user.id,
        teamId,
        title,
        documentDataId,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  deleteDocument: authenticatedProcedure
    .input(ZDeleteDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, teamId } = input;

      const userId = ctx.user.id;

      return await deleteDocument({
        id,
        userId,
        teamId,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  moveDocumentToTeam: authenticatedProcedure
    .input(ZMoveDocumentsToTeamSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId } = input;
      const userId = ctx.user.id;

      return await moveDocumentToTeam({
        documentId,
        teamId,
        userId,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  findDocuments: authenticatedProcedure
    .input(ZFindDocumentsQuerySchema)
    .query(async ({ input, ctx }) => {
      const { user } = ctx;

      const { search, teamId, templateId, page, perPage, orderBy, source, status } = input;

      const documents = await findDocuments({
        userId: user.id,
        teamId,
        templateId,
        search,
        source,
        status,
        page,
        perPage,
        orderBy,
      });

      return documents;
    }),

  findDocumentAuditLogs: authenticatedProcedure
    .input(ZFindDocumentAuditLogsQuerySchema)
    .query(async ({ input, ctx }) => {
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
    }),

  // Todo: Add API
  setSettingsForDocument: authenticatedProcedure
    .input(ZSetSettingsForDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId, data, meta } = input;

      const userId = ctx.user.id;

      const requestMetadata = extractNextApiRequestMetadata(ctx.req);

      if (meta.timezone || meta.dateFormat || meta.redirectUrl) {
        await upsertDocumentMeta({
          documentId,
          dateFormat: meta.dateFormat,
          timezone: meta.timezone,
          redirectUrl: meta.redirectUrl,
          language: meta.language,
          userId: ctx.user.id,
          requestMetadata,
        });
      }

      return await updateDocumentSettings({
        userId,
        teamId,
        documentId,
        data,
        requestMetadata,
      });
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
    }),

  setSigningOrderForDocument: authenticatedProcedure
    .input(ZSetSigningOrderForDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, signingOrder } = input;

      return await upsertDocumentMeta({
        documentId,
        signingOrder,
        userId: ctx.user.id,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  updateTypedSignatureSettings: authenticatedProcedure
    .input(ZUpdateTypedSignatureSettingsMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId, typedSignatureEnabled } = input;

      const document = await getDocumentById({
        id: documentId,
        teamId,
        userId: ctx.user.id,
      }).catch(() => null);

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      return await upsertDocumentMeta({
        documentId,
        typedSignatureEnabled,
        userId: ctx.user.id,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  sendDocument: authenticatedProcedure
    .input(ZSendDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId, meta } = input;

      if (
        meta.message ||
        meta.subject ||
        meta.timezone ||
        meta.dateFormat ||
        meta.redirectUrl ||
        meta.distributionMethod ||
        meta.emailSettings
      ) {
        await upsertDocumentMeta({
          documentId,
          subject: meta.subject,
          message: meta.message,
          dateFormat: meta.dateFormat,
          timezone: meta.timezone,
          redirectUrl: meta.redirectUrl,
          distributionMethod: meta.distributionMethod,
          userId: ctx.user.id,
          emailSettings: meta.emailSettings,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      }

      return await sendDocument({
        userId: ctx.user.id,
        documentId,
        teamId,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  resendDocument: authenticatedProcedure
    .input(ZResendDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await resendDocument({
        userId: ctx.user.id,
        ...input,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  duplicateDocument: authenticatedProcedure
    .input(ZGetDocumentByIdQuerySchema)
    .mutation(async ({ input, ctx }) => {
      return await duplicateDocumentById({
        userId: ctx.user.id,
        ...input,
      });
    }),

  searchDocuments: authenticatedProcedure
    .input(ZSearchDocumentsMutationSchema)
    .query(async ({ input, ctx }) => {
      const { query } = input;

      const documents = await searchDocumentsWithKeyword({
        query,
        userId: ctx.user.id,
      });

      return documents;
    }),

  downloadAuditLogs: authenticatedProcedure
    .input(ZDownloadAuditLogsMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId } = input;

      const document = await getDocumentById({
        id: documentId,
        userId: ctx.user.id,
        teamId,
      }).catch(() => null);

      if (!document || (teamId && document.teamId !== teamId)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this document.',
        });
      }

      const encrypted = encryptSecondaryData({
        data: document.id.toString(),
        expiresAt: DateTime.now().plus({ minutes: 5 }).toJSDate().valueOf(),
      });

      return {
        url: `${NEXT_PUBLIC_WEBAPP_URL()}/__htmltopdf/audit-log?d=${encrypted}`,
      };
    }),

  downloadCertificate: authenticatedProcedure
    .input(ZDownloadCertificateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId } = input;

      const document = await getDocumentById({
        id: documentId,
        userId: ctx.user.id,
        teamId,
      });

      if (document.status !== DocumentStatus.COMPLETED) {
        throw new AppError('DOCUMENT_NOT_COMPLETE');
      }

      const encrypted = encryptSecondaryData({
        data: document.id.toString(),
        expiresAt: DateTime.now().plus({ minutes: 5 }).toJSDate().valueOf(),
      });

      return {
        url: `${NEXT_PUBLIC_WEBAPP_URL()}/__htmltopdf/certificate?d=${encrypted}`,
      };
    }),
});
