import { match } from 'ts-pattern';

import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { CreateDocumentAuditLogDataResponse } from '@documenso/lib/utils/document-audit-logs';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { DocumentVisibility } from '@documenso/prisma/client';
import { DocumentStatus, TeamMemberRole } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import { createDocumentAuthOptions, extractDocumentAuthMethods } from '../../utils/document-auth';

export type UpdateDocumentOptions = {
  userId: number;
  teamId?: number;
  documentId: number;
  data?: {
    title?: string;
    externalId?: string | null;
    visibility?: DocumentVisibility | null;
    includeSigningCertificate?: boolean;
    includeAuditTrailLog?: boolean;
    globalAccessAuth?: TDocumentAccessAuthTypes | null;
    globalActionAuth?: TDocumentActionAuthTypes | null;
  };
  requestMetadata: ApiRequestMetadata;
};

export const updateDocument = async ({
  userId,
  teamId,
  documentId,
  data,
  requestMetadata,
}: UpdateDocumentOptions) => {
  const document = await prisma.document.findFirst({
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
    include: {
      team: {
        select: {
          members: {
            where: {
              userId,
            },
            select: {
              role: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  if (teamId) {
    const currentUserRole = document.team?.members[0]?.role;
    const isDocumentOwner = document.userId === userId;
    const requestedVisibility = data?.visibility;

    if (!isDocumentOwner) {
      match(currentUserRole)
        .with(TeamMemberRole.ADMIN, () => true)
        .with(TeamMemberRole.MANAGER, () => {
          const allowedVisibilities: DocumentVisibility[] = [
            DocumentVisibility.EVERYONE,
            DocumentVisibility.MANAGER_AND_ABOVE,
          ];

          if (
            !allowedVisibilities.includes(document.visibility) ||
            (requestedVisibility && !allowedVisibilities.includes(requestedVisibility))
          ) {
            throw new AppError(AppErrorCode.UNAUTHORIZED, {
              message: 'You do not have permission to update the document visibility',
            });
          }
        })
        .with(TeamMemberRole.MEMBER, () => {
          if (
            document.visibility !== DocumentVisibility.EVERYONE ||
            (requestedVisibility && requestedVisibility !== DocumentVisibility.EVERYONE)
          ) {
            throw new AppError(AppErrorCode.UNAUTHORIZED, {
              message: 'You do not have permission to update the document visibility',
            });
          }
        })
        .otherwise(() => {
          throw new AppError(AppErrorCode.UNAUTHORIZED, {
            message: 'You do not have permission to update the document',
          });
        });
    }
  }

  // If no data just return the document since this function is normally chained after a meta update.
  if (!data || Object.values(data).length === 0) {
    return document;
  }

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
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to set the action auth',
      });
    }
  }

  const isTitleSame = data.title === undefined || data.title === document.title;
  const isExternalIdSame = data.externalId === undefined || data.externalId === document.externalId;
  const isGlobalAccessSame =
    documentGlobalAccessAuth === undefined || documentGlobalAccessAuth === newGlobalAccessAuth;
  const isGlobalActionSame =
    documentGlobalActionAuth === undefined || documentGlobalActionAuth === newGlobalActionAuth;
  const isDocumentVisibilitySame =
    data.visibility === undefined || data.visibility === document.visibility;
  const isIncludeSigningCertificateSame =
    data.includeSigningCertificate === undefined ||
    data.includeSigningCertificate === document.includeSigningCertificate;
  const isIncludeAuditTrailLogSame =
    data.includeAuditTrailLog === undefined ||
    data.includeAuditTrailLog === document.includeAuditTrailLog;

  const auditLogs: CreateDocumentAuditLogDataResponse[] = [];

  if (!isTitleSame && document.status !== DocumentStatus.DRAFT) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'You cannot update the title if the document has been sent',
    });
  }

  if (!isTitleSame) {
    auditLogs.push(
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_TITLE_UPDATED,
        documentId,
        metadata: requestMetadata,
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
        metadata: requestMetadata,
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
        metadata: requestMetadata,
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
        metadata: requestMetadata,
        data: {
          from: documentGlobalActionAuth,
          to: newGlobalActionAuth,
        },
      }),
    );
  }

  if (!isDocumentVisibilitySame) {
    auditLogs.push(
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_VISIBILITY_UPDATED,
        documentId,
        metadata: requestMetadata,
        data: {
          from: document.visibility,
          to: data.visibility || '',
        },
      }),
    );
  }

  if (!isIncludeSigningCertificateSame) {
    auditLogs.push(
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SIGNING_CERTIFICATE_UPDATED,
        documentId,
        metadata: requestMetadata,
        data: {
          from: String(document.includeSigningCertificate),
          to: String(data.includeSigningCertificate || false),
        },
      }),
    );
  }

  if (!isIncludeAuditTrailLogSame) {
    auditLogs.push(
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_AUDIT_TRAIL_UPDATED,
        documentId,
        metadata: requestMetadata,
        data: {
          from: String(document.includeAuditTrailLog),
          to: String(data.includeAuditTrailLog || false),
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
        externalId: data.externalId,
        visibility: data.visibility as DocumentVisibility,
        includeSigningCertificate: data.includeSigningCertificate,
        includeAuditTrailLog: data.includeAuditTrailLog,
        authOptions,
      },
    });

    await tx.documentAuditLog.createMany({
      data: auditLogs,
    });

    return updatedDocument;
  });
};
