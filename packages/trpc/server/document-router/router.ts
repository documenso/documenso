import { TRPCError } from '@trpc/server';
import { DateTime } from 'luxon';
import { z } from 'zod';

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
  ZDeleteDocumentMutationSchema,
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
  // Internal endpoint for now.
  getDocumentById: authenticatedProcedure
    .input(ZGetDocumentByIdQuerySchema)
    .query(async ({ input, ctx }) => {
      return await getDocumentById({
        ...input,
        userId: ctx.user.id,
      });
    }),

  // Internal endpoint for now.
  getDocumentByToken: procedure
    .input(ZGetDocumentByTokenQuerySchema)
    .query(async ({ input, ctx }) => {
      const { token } = input;

      return await getDocumentAndSenderByToken({
        token,
        userId: ctx.user?.id,
      });
    }),

  findDocuments: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/document/find',
        summary: 'Find documents',
        description: 'Find documents based on a search criteria',
        tags: ['Documents'],
      },
    })
    .input(ZFindDocumentsQuerySchema)
    .output(z.unknown())
    .query(async ({ input, ctx }) => {
      const { user } = ctx;

      const { query, teamId, templateId, page, perPage, orderBy, source, status } = input;

      const documents = await findDocuments({
        userId: user.id,
        teamId,
        templateId,
        query,
        source,
        status,
        page,
        perPage,
        orderBy,
      });

      return documents;
    }),

  getDocumentWithDetailsById: authenticatedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/document/{documentId}',
        summary: 'Get document',
        description: 'Returns a document given an ID',
        tags: ['Documents'],
      },
    })
    .input(ZGetDocumentWithDetailsByIdQuerySchema)
    .output(z.unknown())
    .query(async ({ input, ctx }) => {
      return await getDocumentWithDetailsById({
        ...input,
        userId: ctx.user.id,
      });
    }),

  createDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/create',
        summary: 'Create document',
        tags: ['Documents'],
      },
    })
    .input(ZCreateDocumentMutationSchema)
    .output(z.unknown())
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

  // Todo: Refactor to updateDocument.
  setSettingsForDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/{documentId}',
        summary: 'Update document',
        tags: ['Documents'],
      },
    })
    .input(ZSetSettingsForDocumentMutationSchema)
    .output(z.unknown())
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

  deleteDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/{documentId}/delete',
        summary: 'Delete document',
        tags: ['Documents'],
      },
    })
    .input(ZDeleteDocumentMutationSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const { documentId, teamId } = input;

      const userId = ctx.user.id;

      return await deleteDocument({
        id: documentId,
        userId,
        teamId,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  moveDocumentToTeam: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/{documentId}/move',
        summary: 'Move document',
        description: 'Move a document to a team',
        tags: ['Documents'],
      },
    })
    .input(ZMoveDocumentsToTeamSchema)
    .output(z.unknown())
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

  // Internal endpoint for now.
  // Should probably use `updateDocument`
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

  // Internal endpoint for now.
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

  // Internal endpoint for now.
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

  // Internal endpoint for now.
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
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  // Todo: Refactor to distributeDocument.
  // Todo: Rework before releasing API.
  sendDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/{documentId}/distribute',
        summary: 'Distribute document',
        description: 'Send the document out to recipients based on your distribution method',
        tags: ['Documents'],
      },
    })
    .input(ZSendDocumentMutationSchema)
    .output(z.unknown())
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/{documentId}/resend',
        summary: 'Resend document',
        description:
          'Resend the document to recipients who have not signed. Will use the distribution method set in the document.',
        tags: ['Documents'],
      },
    })
    .input(ZResendDocumentMutationSchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      return await resendDocument({
        userId: ctx.user.id,
        ...input,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  duplicateDocument: authenticatedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/document/{documentId}/duplicate',
        summary: 'Duplicate document',
        tags: ['Documents'],
      },
    })
    .input(ZGetDocumentByIdQuerySchema)
    .output(z.unknown())
    .mutation(async ({ input, ctx }) => {
      return await duplicateDocumentById({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Internal endpoint for now.
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

  // Internal endpoint for now.
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

  // Internal endpoint for now.
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

  // Internal endpoint for now.
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
