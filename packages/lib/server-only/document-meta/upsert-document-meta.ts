'use server';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import {
  createDocumentAuditLogData,
  diffDocumentMetaChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import type { DocumentDistributionMethod, DocumentSigningOrder } from '@documenso/prisma/client';

import type { SupportedLanguageCodes } from '../../constants/i18n';
import type { TDocumentEmailSettings } from '../../types/document-email';

export type CreateDocumentMetaOptions = {
  userId: number;
  teamId?: number;
  documentId: number;
  subject?: string;
  message?: string;
  timezone?: string;
  password?: string;
  dateFormat?: string;
  redirectUrl?: string;
  emailSettings?: TDocumentEmailSettings;
  signingOrder?: DocumentSigningOrder;
  distributionMethod?: DocumentDistributionMethod;
  typedSignatureEnabled?: boolean;
  language?: SupportedLanguageCodes;
  requestMetadata: ApiRequestMetadata;
};

export const upsertDocumentMeta = async ({
  userId,
  teamId,
  subject,
  message,
  timezone,
  dateFormat,
  documentId,
  password,
  redirectUrl,
  signingOrder,
  emailSettings,
  distributionMethod,
  typedSignatureEnabled,
  language,
  requestMetadata,
}: CreateDocumentMetaOptions) => {
  const { documentMeta: originalDocumentMeta } = await prisma.document.findFirstOrThrow({
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
      documentMeta: true,
    },
  });

  return await prisma.$transaction(async (tx) => {
    const upsertedDocumentMeta = await tx.documentMeta.upsert({
      where: {
        documentId,
      },
      create: {
        subject,
        message,
        password,
        dateFormat,
        timezone,
        documentId,
        redirectUrl,
        signingOrder,
        emailSettings,
        distributionMethod,
        typedSignatureEnabled,
        language,
      },
      update: {
        subject,
        message,
        password,
        dateFormat,
        timezone,
        redirectUrl,
        signingOrder,
        emailSettings,
        distributionMethod,
        typedSignatureEnabled,
        language,
      },
    });

    const changes = diffDocumentMetaChanges(originalDocumentMeta ?? {}, upsertedDocumentMeta);

    if (changes.length > 0) {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_META_UPDATED,
          documentId,
          metadata: requestMetadata,
          data: {
            changes: diffDocumentMetaChanges(originalDocumentMeta ?? {}, upsertedDocumentMeta),
          },
        }),
      });
    }

    return upsertedDocumentMeta;
  });
};
