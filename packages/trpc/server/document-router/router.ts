import { TRPCError } from '@trpc/server';
import { DateTime } from 'luxon';
import { z } from 'zod';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { AppError } from '@documenso/lib/errors/app-error';
import { encryptSecondaryData } from '@documenso/lib/server-only/crypto/encrypt';
import { upsertDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import {
  ZCreateDocumentResponseSchema,
  createDocument,
} from '@documenso/lib/server-only/document/create-document';
import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import {
  ZDuplicateDocumentResponseSchema,
  duplicateDocument,
} from '@documenso/lib/server-only/document/duplicate-document-by-id';
import { findDocumentAuditLogs } from '@documenso/lib/server-only/document/find-document-audit-logs';
import {
  ZFindDocumentsResponseSchema,
  findDocuments,
} from '@documenso/lib/server-only/document/find-documents';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import {
  ZGetDocumentWithDetailsByIdResponseSchema,
  getDocumentWithDetailsById,
} from '@documenso/lib/server-only/document/get-document-with-details-by-id';
import {
  ZMoveDocumentToTeamResponseSchema,
  moveDocumentToTeam,
} from '@documenso/lib/server-only/document/move-document-to-team';
import { resendDocument } from '@documenso/lib/server-only/document/resend-document';
import { searchDocumentsWithKeyword } from '@documenso/lib/server-only/document/search-documents-with-keyword';
import {
  ZSendDocumentResponseSchema,
  sendDocument,
} from '@documenso/lib/server-only/document/send-document';
import {
  ZUpdateDocumentSettingsResponseSchema,
  updateDocumentSettings,
} from '@documenso/lib/server-only/document/update-document-settings';
import { symmetricEncrypt } from '@documenso/lib/universal/crypto';
import { DocumentStatus } from '@documenso/prisma/client';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZCreateDocumentMutationSchema,
  ZDeleteDocumentMutationSchema,
  ZDownloadAuditLogsMutationSchema,
  ZDownloadCertificateMutationSchema,
  ZDuplicateDocumentMutationSchema,
  ZFindDocumentAuditLogsQuerySchema,
  ZFindDocumentsQuerySchema,
  ZGetDocumentByIdQuerySchema,
  ZGetDocumentByTokenQuerySchema,
  ZGetDocumentWithDetailsByIdQuerySchema,
  ZMoveDocumentToTeamSchema,
  ZResendDocumentMutationSchema,
  ZSearchDocumentsMutationSchema,
  ZSendDocumentMutationSchema,
  ZSetPasswordForDocumentMutationSchema,
  ZSetSettingsForDocumentMutationSchema,
  ZSetSigningOrderForDocumentMutationSchema,
  ZUpdateTypedSignatureSettingsMutationSchema,
} from './schema';

export const documentRouter = router({
  /**
   * @private
   */
  getDocumentById: authenticatedProcedure
    .input(ZGetDocumentByIdQuerySchema)
    .query(async ({ input, ctx }) => {
      return await getDocumentById({
        ...input,
        userId: ctx.user.id,
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
        path: '/document/find',
        summary: 'Find documents',
        description: 'Find documents based on a search criteria',
        tags: ['Document'],
      },
    })
    .input(ZFindDocumentsQuerySchema)
    .output(ZFindDocumentsResponseSchema)
    .query(async ({ input, ctx }) => {
      const { user } = ctx;

      const {
        query,
        teamId,
        templateId,
        page,
        perPage,
        orderByDirection,
        orderByColumn,
        source,
        status,
      } = input;

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
    .input(ZGetDocumentWithDetailsByIdQuerySchema)
    .output(ZGetDocumentWithDetailsByIdResponseSchema)
    .query(async ({ input, ctx }) => {
      return await getDocumentWithDetailsById({
        ...input,
        userId: ctx.user.id,
      });
    }),

  /**
   * @public
   */
  createDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/create',
        summary: 'Create document',
        tags: ['Document'],
      },
    })
    .input(ZCreateDocumentMutationSchema)
    .output(ZCreateDocumentResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { title, documentDataId, teamId, timezone } = input;

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
        path: '/document/{documentId}',
        summary: 'Update document',
        tags: ['Document'],
      },
    })
    .input(ZSetSettingsForDocumentMutationSchema)
    .output(ZUpdateDocumentSettingsResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId, data, meta } = input;

      const userId = ctx.user.id;

      if (meta.timezone || meta.dateFormat || meta.redirectUrl) {
        await upsertDocumentMeta({
          documentId,
          dateFormat: meta.dateFormat,
          timezone: meta.timezone,
          redirectUrl: meta.redirectUrl,
          language: meta.language,
          userId: ctx.user.id,
          requestMetadata: ctx.metadata,
        });
      }

      return await updateDocumentSettings({
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
        path: '/document/{documentId}/delete',
        summary: 'Delete document',
        tags: ['Document'],
      },
    })
    .input(ZDeleteDocumentMutationSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId } = input;

      const userId = ctx.user.id;

      await deleteDocument({
        id: documentId,
        userId,
        teamId,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   */
  moveDocumentToTeam: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/{documentId}/move',
        summary: 'Move document',
        description: 'Move a document to a team',
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
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @private
   */
  setSigningOrderForDocument: authenticatedProcedure
    .input(ZSetSigningOrderForDocumentMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, signingOrder } = input;

      return await upsertDocumentMeta({
        documentId,
        signingOrder,
        userId: ctx.user.id,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @private
   */
  updateTypedSignatureSettings: authenticatedProcedure
    .input(ZUpdateTypedSignatureSettingsMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId, typedSignatureEnabled } = input;

      const document = await getDocumentById({
        documentId,
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
        path: '/document/{documentId}/distribute',
        summary: 'Distribute document',
        description: 'Send the document out to recipients based on your distribution method',
        tags: ['Document'],
      },
    })
    .input(ZSendDocumentMutationSchema)
    .output(ZSendDocumentResponseSchema)
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
   */
  resendDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/{documentId}/resend',
        summary: 'Resend document',
        description:
          'Resend the document to recipients who have not signed. Will use the distribution method set in the document.',
        tags: ['Document'],
      },
    })
    .input(ZResendDocumentMutationSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      return await resendDocument({
        userId: ctx.user.id,
        ...input,
        requestMetadata: ctx.metadata,
      });
    }),

  /**
   * @public
   */
  duplicateDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/{documentId}/duplicate',
        summary: 'Duplicate document',
        tags: ['Document'],
      },
    })
    .input(ZDuplicateDocumentMutationSchema)
    .output(ZDuplicateDocumentResponseSchema)
    .mutation(async ({ input, ctx }) => {
      return await duplicateDocument({
        userId: ctx.user.id,
        ...input,
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
        page,
        perPage,
        documentId,
        cursor,
        filterForRecentActivity,
        orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
        userId: ctx.user.id,
      });
    }),

  /**
   * @private
   */
  downloadAuditLogs: authenticatedProcedure
    .input(ZDownloadAuditLogsMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId } = input;

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
      const { documentId, teamId } = input;

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
