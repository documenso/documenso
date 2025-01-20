import { TRPCError } from '@trpc/server';
import { DateTime } from 'luxon';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { encryptSecondaryData } from '@documenso/lib/server-only/crypto/encrypt';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { upsertDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { createDocument } from '@documenso/lib/server-only/document/create-document';
import { createDocumentV2 } from '@documenso/lib/server-only/document/create-document-v2';
import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import { duplicateDocument } from '@documenso/lib/server-only/document/duplicate-document-by-id';
import { findDocumentAuditLogs } from '@documenso/lib/server-only/document/find-document-audit-logs';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { getDocumentWithDetailsById } from '@documenso/lib/server-only/document/get-document-with-details-by-id';
import { moveDocumentToTeam } from '@documenso/lib/server-only/document/move-document-to-team';
import { resendDocument } from '@documenso/lib/server-only/document/resend-document';
import { searchDocumentsWithKeyword } from '@documenso/lib/server-only/document/search-documents-with-keyword';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { updateDocument } from '@documenso/lib/server-only/document/update-document';
import { symmetricEncrypt } from '@documenso/lib/universal/crypto';
import { getPresignPostUrl } from '@documenso/lib/universal/upload/server-actions';
import { DocumentDataType, DocumentStatus } from '@documenso/prisma/client';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZCreateDocumentRequestSchema,
  ZCreateDocumentV2RequestSchema,
  ZCreateDocumentV2ResponseSchema,
  ZDeleteDocumentMutationSchema,
  ZDistributeDocumentRequestSchema,
  ZDistributeDocumentResponseSchema,
  ZDownloadAuditLogsMutationSchema,
  ZDownloadCertificateMutationSchema,
  ZDuplicateDocumentRequestSchema,
  ZDuplicateDocumentResponseSchema,
  ZFindDocumentAuditLogsQuerySchema,
  ZFindDocumentsRequestSchema,
  ZFindDocumentsResponseSchema,
  ZGenericSuccessResponse,
  ZGetDocumentByIdQuerySchema,
  ZGetDocumentByTokenQuerySchema,
  ZGetDocumentWithDetailsByIdRequestSchema,
  ZGetDocumentWithDetailsByIdResponseSchema,
  ZMoveDocumentToTeamResponseSchema,
  ZMoveDocumentToTeamSchema,
  ZResendDocumentMutationSchema,
  ZSearchDocumentsMutationSchema,
  ZSetPasswordForDocumentMutationSchema,
  ZSetSigningOrderForDocumentMutationSchema,
  ZSuccessResponseSchema,
  ZUpdateDocumentRequestSchema,
  ZUpdateDocumentResponseSchema,
} from './schema';

export const documentRouter = router({
  /**
   * @private
   */
  getDocumentById: authenticatedProcedure
    .input(ZGetDocumentByIdQuerySchema)
    .query(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId } = input;

      return await getDocumentById({
        userId: ctx.user.id,
        teamId,
        documentId,
      });
    }),

  /**
   * @private
   */
  getDocumentByToken: procedure
    .input(ZGetDocumentByTokenQuerySchema)
    .query(async ({ input, ctx }) => {
      const { token } = input;

      return await getDocumentAndSenderByToken({
        token,
        userId: ctx.user?.id,
      });
    }),

  /**
   * @public
   */
  findDocuments: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/document',
        summary: 'Find documents',
        description: 'Find documents based on a search criteria',
        tags: ['Document'],
      },
    })
    .input(ZFindDocumentsRequestSchema)
    .output(ZFindDocumentsResponseSchema)
    .query(async ({ input, ctx }) => {
      const { user, teamId } = ctx;

      const { query, templateId, page, perPage, orderByDirection, orderByColumn, source, status } =
        input;

      const documents = await findDocuments({
        userId: user.id,
        teamId,
        templateId,
        query,
        source,
        status,
        page,
        perPage,
        orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
      });

      return documents;
    }),

  /**
   * @public
   *
   * Todo: Refactor to getDocumentById.
   */
  getDocumentWithDetailsById: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/document/{documentId}',
        summary: 'Get document',
        description: 'Returns a document given an ID',
        tags: ['Document'],
      },
    })
    .input(ZGetDocumentWithDetailsByIdRequestSchema)
    .output(ZGetDocumentWithDetailsByIdResponseSchema)
    .query(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { documentId } = input;

      return await getDocumentWithDetailsById({
        userId: user.id,
        teamId,
        documentId,
      });
    }),

  /**
   * Temporariy endpoint for V2 Beta until we allow passthrough documents on create.
   *
   * @public
   * @deprecated
   */
  createDocumentTemporary: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/create/beta',
        summary: 'Create document',
        description:
          'You will need to upload the PDF to the provided URL returned. Note: Once V2 API is released, this will be removed since we will allow direct uploads, instead of using an upload URL.',
        tags: ['Document'],
      },
    })
    .input(ZCreateDocumentV2RequestSchema)
    .output(ZCreateDocumentV2ResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;

      const {
        title,
        externalId,
        visibility,
        globalAccessAuth,
        globalActionAuth,
        recipients,
        meta,
      } = input;

      const { remaining } = await getServerLimits({ email: ctx.user.email, teamId });

      if (remaining.documents <= 0) {
        throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
          message: 'You have reached your document limit for this month. Please upgrade your plan.',
          statusCode: 400,
        });
      }

      const fileName = title.endsWith('.pdf') ? title : `${title}.pdf`;

      const { url, key } = await getPresignPostUrl(fileName, 'application/pdf');

      const documentData = await createDocumentData({
        data: key,
        type: DocumentDataType.S3_PATH,
      });

      const createdDocument = await createDocumentV2({
        userId: ctx.user.id,
        teamId,
        documentDataId: documentData.id,
        normalizePdf: false, // Not normalizing because of presigned URL.
        data: {
          title,
          externalId,
          visibility,
          globalAccessAuth,
          globalActionAuth,
          recipients,
        },
        meta,
        requestMetadata: ctx.metadata,
      });

      return {
        document: createdDocument,
        uploadUrl: url,
      };
    }),

  /**
   * Wait until RR7 so we can passthrough documents.
   *
   * @private
   */
  createDocument: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/document/create',
    //     summary: 'Create document',
    //     tags: ['Document'],
    //   },
    // })
    .input(ZCreateDocumentRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { title, documentDataId, timezone } = input;

      const { remaining } = await getServerLimits({ email: ctx.user.email, teamId });

      if (remaining.documents <= 0) {
        throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
          message: 'You have reached your document limit for this month. Please upgrade your plan.',
          statusCode: 400,
        });
      }

      return await createDocument({
        userId: ctx.user.id,
        teamId,
        title,
        documentDataId,
        normalizePdf: true,
        timezone,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   *
   * Todo: Refactor to updateDocument.
   */
  setSettingsForDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/update',
        summary: 'Update document',
        tags: ['Document'],
      },
    })
    .input(ZUpdateDocumentRequestSchema)
    .output(ZUpdateDocumentResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, data, meta = {} } = input;

      const userId = ctx.user.id;

      if (Object.values(meta).length > 0) {
        await upsertDocumentMeta({
          userId: ctx.user.id,
          teamId,
          documentId,
          subject: meta.subject,
          message: meta.message,
          timezone: meta.timezone,
          dateFormat: meta.dateFormat,
          language: meta.language,
          typedSignatureEnabled: meta.typedSignatureEnabled,
          redirectUrl: meta.redirectUrl,
          distributionMethod: meta.distributionMethod,
          signingOrder: meta.signingOrder,
          emailSettings: meta.emailSettings,
          requestMetadata: ctx.metadata,
        });
      }

      return await updateDocument({
        userId,
        teamId,
        documentId,
        data,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   */
  deleteDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/delete',
        summary: 'Delete document',
        tags: ['Document'],
      },
    })
    .input(ZDeleteDocumentMutationSchema)
    .output(ZSuccessResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId } = input;

      const userId = ctx.user.id;

      await deleteDocument({
        id: documentId,
        userId,
        teamId,
        requestMetadata: ctx.metadata,
      });

      return ZGenericSuccessResponse;
    }),

  /**
   * @public
   */
  moveDocumentToTeam: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/move',
        summary: 'Move document',
        description: 'Move a document from your personal account to a team',
        tags: ['Document'],
      },
    })
    .input(ZMoveDocumentToTeamSchema)
    .output(ZMoveDocumentToTeamResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId } = input;
      const userId = ctx.user.id;

      return await moveDocumentToTeam({
        documentId,
        teamId,
        userId,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @private
   */
  setPasswordForDocument: authenticatedProcedure
    .input(ZSetPasswordForDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
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
        userId: ctx.user.id,
        teamId,
        documentId,
        password: securePassword,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @private
   *
   * Todo: Remove and use `updateDocument` endpoint instead.
   */
  setSigningOrderForDocument: authenticatedProcedure
    .input(ZSetSigningOrderForDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, signingOrder } = input;

      return await upsertDocumentMeta({
        userId: ctx.user.id,
        teamId,
        documentId,
        signingOrder,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   *
   * Todo: Refactor to distributeDocument.
   * Todo: Rework before releasing API.
   */
  sendDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/distribute',
        summary: 'Distribute document',
        description: 'Send the document out to recipients based on your distribution method',
        tags: ['Document'],
      },
    })
    .input(ZDistributeDocumentRequestSchema)
    .output(ZDistributeDocumentResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, meta = {} } = input;

      if (Object.values(meta).length > 0) {
        await upsertDocumentMeta({
          userId: ctx.user.id,
          teamId,
          documentId,
          subject: meta.subject,
          message: meta.message,
          dateFormat: meta.dateFormat,
          timezone: meta.timezone,
          redirectUrl: meta.redirectUrl,
          distributionMethod: meta.distributionMethod,
          emailSettings: meta.emailSettings,
          language: meta.language,
          requestMetadata: ctx.metadata,
        });
      }

      return await sendDocument({
        userId: ctx.user.id,
        documentId,
        teamId,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   *
   * Todo: Refactor to redistributeDocument.
   */
  resendDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/redistribute',
        summary: 'Redistribute document',
        description:
          'Redistribute the document to the provided recipients who have not actioned the document. Will use the distribution method set in the document',
        tags: ['Document'],
      },
    })
    .input(ZResendDocumentMutationSchema)
    .output(ZSuccessResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId, recipients } = input;

      await resendDocument({
        userId: ctx.user.id,
        teamId,
        documentId,
        recipients,
        requestMetadata: ctx.metadata,
      });

      return ZGenericSuccessResponse;
    }),

  /**
   * @public
   */
  duplicateDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/duplicate',
        summary: 'Duplicate document',
        tags: ['Document'],
      },
    })
    .input(ZDuplicateDocumentRequestSchema)
    .output(ZDuplicateDocumentResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId, user } = ctx;
      const { documentId } = input;

      return await duplicateDocument({
        userId: user.id,
        teamId,
        documentId,
      });
    }),

  /**
   * @private
   */
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

  /**
   * @private
   */
  findDocumentAuditLogs: authenticatedProcedure
    .input(ZFindDocumentAuditLogsQuerySchema)
    .query(async ({ input, ctx }) => {
      const { teamId } = ctx;

      const {
        page,
        perPage,
        documentId,
        cursor,
        filterForRecentActivity,
        orderByColumn,
        orderByDirection,
      } = input;

      return await findDocumentAuditLogs({
        userId: ctx.user.id,
        teamId,
        page,
        perPage,
        documentId,
        cursor,
        filterForRecentActivity,
        orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
      });
    }),

  /**
   * @private
   */
  downloadAuditLogs: authenticatedProcedure
    .input(ZDownloadAuditLogsMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId } = input;

      const document = await getDocumentById({
        documentId,
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

  /**
   * @private
   */
  downloadCertificate: authenticatedProcedure
    .input(ZDownloadCertificateMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { teamId } = ctx;
      const { documentId } = input;

      const document = await getDocumentById({
        documentId,
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
