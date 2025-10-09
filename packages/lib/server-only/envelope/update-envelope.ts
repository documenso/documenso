import type { DocumentMeta, DocumentVisibility, Prisma, TemplateType } from '@prisma/client';
import { EnvelopeType, FolderType } from '@prisma/client';
import { DocumentStatus } from '@prisma/client';
import { isDeepEqual } from 'remeda';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { CreateDocumentAuditLogDataResponse } from '@documenso/lib/utils/document-audit-logs';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import { createDocumentAuthOptions, extractDocumentAuthMethods } from '../../utils/document-auth';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { buildTeamWhereQuery, canAccessTeamDocument } from '../../utils/teams';
import { getEnvelopeWhereInput } from './get-envelope-by-id';

export type UpdateEnvelopeOptions = {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  data?: {
    title?: string;
    folderId?: string | null;
    externalId?: string | null;
    visibility?: DocumentVisibility;
    globalAccessAuth?: TDocumentAccessAuthTypes[];
    globalActionAuth?: TDocumentActionAuthTypes[];
    publicTitle?: string;
    publicDescription?: string;
    templateType?: TemplateType;
    useLegacyFieldInsertion?: boolean;
  };
  meta?: Partial<Omit<DocumentMeta, 'id'>>;
  requestMetadata: ApiRequestMetadata;
};

export const updateEnvelope = async ({
  userId,
  teamId,
  id,
  data = {},
  meta = {},
  requestMetadata,
}: UpdateEnvelopeOptions) => {
  const { envelopeWhereInput, team } = await getEnvelopeWhereInput({
    id,
    type: null, // Allow updating both documents and templates.
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      documentMeta: true,
      team: {
        select: {
          organisationId: true,
          organisation: {
            select: {
              organisationClaim: true,
            },
          },
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  if (
    envelope.type !== EnvelopeType.TEMPLATE &&
    (data.publicTitle || data.publicDescription || data.templateType)
  ) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'You cannot update the template fields for document type envelopes',
    });
  }

  // If no data just return the document since this function is normally chained after a meta update.
  if (Object.values(data).length === 0 && Object.keys(meta).length === 0) {
    return envelope;
  }

  const isEnvelopeOwner = envelope.userId === userId;

  // Validate whether the new visibility setting is allowed for the current user.
  if (
    !isEnvelopeOwner &&
    data?.visibility &&
    !canAccessTeamDocument(team.currentTeamRole, data.visibility)
  ) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to update the envelope visibility',
    });
  }

  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
  });

  const documentGlobalAccessAuth = documentAuthOption?.globalAccessAuth ?? null;
  const documentGlobalActionAuth = documentAuthOption?.globalActionAuth ?? null;

  // If the new global auth values aren't passed in, fallback to the current document values.
  const newGlobalAccessAuth =
    data?.globalAccessAuth === undefined ? documentGlobalAccessAuth : data.globalAccessAuth;
  const newGlobalActionAuth =
    data?.globalActionAuth === undefined ? documentGlobalActionAuth : data.globalActionAuth;

  // Check if user has permission to set the global action auth.
  if (newGlobalActionAuth.length > 0 && !envelope.team.organisation.organisationClaim.flags.cfr21) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to set the action auth',
    });
  }

  const authOptions = createDocumentAuthOptions({
    globalAccessAuth: newGlobalAccessAuth,
    globalActionAuth: newGlobalActionAuth,
  });

  const emailId = meta.emailId;

  // Validate the emailId belongs to the organisation.
  if (emailId) {
    const email = await prisma.organisationEmail.findFirst({
      where: {
        id: emailId,
        organisationId: envelope.team.organisationId,
      },
    });

    if (!email) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Email not found',
      });
    }
  }

  let folderUpdateQuery: Prisma.FolderUpdateOneWithoutEnvelopesNestedInput | undefined = undefined;

  // Validate folder ID.
  if (data.folderId) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: data.folderId,
        team: buildTeamWhereQuery({
          teamId,
          userId,
        }),
        type: envelope.type === EnvelopeType.TEMPLATE ? FolderType.TEMPLATE : FolderType.DOCUMENT,
        visibility: {
          in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole],
        },
      },
    });

    if (!folder) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Folder not found',
      });
    }

    folderUpdateQuery = {
      connect: {
        id: data.folderId,
      },
    };
  }

  // Move to root folder if folderId is null.
  if (data.folderId === null) {
    folderUpdateQuery = {
      disconnect: true,
    };
  }

  const isTitleSame = data.title === undefined || data.title === envelope.title;
  const isExternalIdSame = data.externalId === undefined || data.externalId === envelope.externalId;
  const isGlobalAccessSame =
    documentGlobalAccessAuth === undefined ||
    isDeepEqual(documentGlobalAccessAuth, newGlobalAccessAuth);
  const isGlobalActionSame =
    documentGlobalActionAuth === undefined ||
    isDeepEqual(documentGlobalActionAuth, newGlobalActionAuth);
  const isDocumentVisibilitySame =
    data.visibility === undefined || data.visibility === envelope.visibility;
  const isFolderSame = data.folderId === undefined || data.folderId === envelope.folderId;
  const isTemplateTypeSame =
    data.templateType === undefined || data.templateType === envelope.templateType;
  const isPublicDescriptionSame =
    data.publicDescription === undefined || data.publicDescription === envelope.publicDescription;
  const isPublicTitleSame =
    data.publicTitle === undefined || data.publicTitle === envelope.publicTitle;

  const auditLogs: CreateDocumentAuditLogDataResponse[] = [];

  if (!isTitleSame && envelope.status !== DocumentStatus.DRAFT) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'You cannot update the title if the envelope has been sent',
    });
  }

  if (!isTitleSame) {
    auditLogs.push(
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_TITLE_UPDATED,
        envelopeId: envelope.id,
        metadata: requestMetadata,
        data: {
          from: envelope.title,
          to: data.title || '',
        },
      }),
    );
  }

  if (!isExternalIdSame) {
    auditLogs.push(
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_EXTERNAL_ID_UPDATED,
        envelopeId: envelope.id,
        metadata: requestMetadata,
        data: {
          from: envelope.externalId,
          to: data.externalId || '',
        },
      }),
    );
  }

  if (!isGlobalAccessSame) {
    auditLogs.push(
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_GLOBAL_AUTH_ACCESS_UPDATED,
        envelopeId: envelope.id,
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
        envelopeId: envelope.id,
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
        envelopeId: envelope.id,
        metadata: requestMetadata,
        data: {
          from: envelope.visibility,
          to: data.visibility || '',
        },
      }),
    );
  }

  // Todo: Decide if we want to log moving the document around.
  // if (!isFolderSame) {
  //   auditLogs.push(
  //     createDocumentAuditLogData({
  //       type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FOLDER_UPDATED,
  //       envelopeId: envelope.id,
  //       metadata: requestMetadata,
  //       data: {
  //         from: envelope.folderId,
  //         to: data.folderId || '',
  //       },
  //     }),
  //   );
  // }

  // Todo: Determine if changes are made
  // Commented out since we didn't detect the changes to sequence.
  // const isMetaSame = isDeepEqual(envelope.documentMeta, meta);
  // Early return if nothing is required.
  // if (
  //   auditLogs.length === 0 &&
  //   data.useLegacyFieldInsertion === undefined &&
  //   isFolderSame &&
  //   isTemplateTypeSame &&
  //   isPublicDescriptionSame &&
  //   isPublicTitleSame
  // ) {
  //   return envelope;
  // }

  return await prisma.$transaction(async (tx) => {
    const updatedEnvelope = await tx.envelope.update({
      where: {
        id: envelope.id,
      },
      data: {
        title: data.title,
        externalId: data.externalId,
        visibility: data.visibility,
        templateType: data.templateType,
        publicDescription: data.publicDescription,
        publicTitle: data.publicTitle,
        useLegacyFieldInsertion: data.useLegacyFieldInsertion,
        authOptions,
        folder: folderUpdateQuery,
        documentMeta: {
          update: {
            ...meta,
            emailSettings: meta?.emailSettings || undefined,
          },
        },
      },
    });

    if (envelope.type === EnvelopeType.DOCUMENT) {
      await tx.documentAuditLog.createMany({
        data: auditLogs,
      });
    }

    return updatedEnvelope;
  });
};
