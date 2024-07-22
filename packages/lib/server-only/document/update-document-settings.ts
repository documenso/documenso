'use server';

import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { CreateDocumentAuditLogDataResponse } from '@documenso/lib/utils/document-audit-logs';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import { createDocumentAuthOptions, extractDocumentAuthMethods } from '../../utils/document-auth';

export type UpdateDocumentSettingsOptions = {
  userId: number;
  teamId?: number;
  documentId: number;
  data: {
    title?: string;
    externalId?: string | null;
    globalAccessAuth?: TDocumentAccessAuthTypes | null;
    globalActionAuth?: TDocumentActionAuthTypes | null;
  };
  requestMetadata?: RequestMetadata;
};

export const updateDocumentSettings = async ({
  userId,
  teamId,
  documentId,
  data,
  requestMetadata,
}: UpdateDocumentSettingsOptions) => {
  if (!data.title && !data.globalAccessAuth && !data.globalActionAuth) {
    throw new AppError(AppErrorCode.INVALID_BODY, 'Missing data to update');
  }

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
  });

  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
  });

  const documentGlobalAccessAuth = documentAuthOption?.globalAccessAuth ?? null;
  const documentGlobalActionAuth = documentAuthOption?.globalActionAuth ?? null;

  // If the new global auth values aren't passed in, fallback to the current document values.
  const newGlobalAccessAuth =
    data?.globalAccessAuth === undefined ? documentGlobalAccessAuth : data.globalAccessAuth;
  const newGlobalActionAuth =
    data?.globalActionAuth === undefined ? documentGlobalActionAuth : data.globalActionAuth;

  // Check if user has permission to set the global action auth.
  if (newGlobalActionAuth) {
    const isDocumentEnterprise = await isUserEnterprise({
      userId,
      teamId,
    });

    if (!isDocumentEnterprise) {
      throw new AppError(
        AppErrorCode.UNAUTHORIZED,
        'You do not have permission to set the action auth',
      );
    }
  }

  const isTitleSame = data.title === document.title;
  const isExternalIdSame = data.externalId === document.externalId;
  const isGlobalAccessSame = documentGlobalAccessAuth === newGlobalAccessAuth;
  const isGlobalActionSame = documentGlobalActionAuth === newGlobalActionAuth;

  const auditLogs: CreateDocumentAuditLogDataResponse[] = [];

  if (!isTitleSame && document.status !== DocumentStatus.DRAFT) {
    throw new AppError(
      AppErrorCode.INVALID_BODY,
      'You cannot update the title if the document has been sent',
    );
  }

  if (!isTitleSame) {
    auditLogs.push(
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_TITLE_UPDATED,
        documentId,
        user,
        requestMetadata,
        data: {
          from: document.title,
          to: data.title || '',
        },
      }),
    );
  }

  if (!isExternalIdSame) {
    auditLogs.push(
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_EXTERNAL_ID_UPDATED,
        documentId,
        user,
        requestMetadata,
        data: {
          from: document.externalId,
          to: data.externalId || '',
        },
      }),
    );
  }

  if (!isGlobalAccessSame) {
    auditLogs.push(
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_GLOBAL_AUTH_ACCESS_UPDATED,
        documentId,
        user,
        requestMetadata,
        data: {
          from: documentGlobalAccessAuth,
          to: newGlobalAccessAuth,
        },
      }),
    );
  }

  if (!isGlobalActionSame) {
    auditLogs.push(
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_GLOBAL_AUTH_ACTION_UPDATED,
        documentId,
        user,
        requestMetadata,
        data: {
          from: documentGlobalActionAuth,
          to: newGlobalActionAuth,
        },
      }),
    );
  }

  // Early return if nothing is required.
  if (auditLogs.length === 0) {
    return document;
  }

  return await prisma.$transaction(async (tx) => {
    const authOptions = createDocumentAuthOptions({
      globalAccessAuth: newGlobalAccessAuth,
      globalActionAuth: newGlobalActionAuth,
    });

    const updatedDocument = await tx.document.update({
      where: {
        id: documentId,
      },
      data: {
        title: data.title,
        externalId: data.externalId || null,
        authOptions,
      },
    });

    await tx.documentAuditLog.createMany({
      data: auditLogs,
    });

    return updatedDocument;
  });
};
