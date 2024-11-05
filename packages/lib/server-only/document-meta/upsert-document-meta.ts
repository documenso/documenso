'use server';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import {
  createDocumentAuditLogData,
  diffDocumentMetaChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import type { DocumentSigningOrder } from '@documenso/prisma/client';

import type { SupportedLanguageCodes } from '../../constants/i18n';

export type CreateDocumentMetaOptions = {
  documentId: number;
  subject?: string;
  message?: string;
  timezone?: string;
  password?: string;
  dateFormat?: string;
  redirectUrl?: string;
  signingOrder?: DocumentSigningOrder;
  typedSignatureEnabled?: boolean;
  language?: SupportedLanguageCodes;
  userId: number;
  requestMetadata: RequestMetadata;
};

export const upsertDocumentMeta = async ({
  subject,
  message,
  timezone,
  dateFormat,
  documentId,
  password,
  userId,
  redirectUrl,
  signingOrder,
  typedSignatureEnabled,
  language,
  requestMetadata,
}: CreateDocumentMetaOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  const { documentMeta: originalDocumentMeta } = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
      OR: [
        {
          userId: user.id,
        },
        {
          team: {
            members: {
              some: {
                userId: user.id,
              },
            },
          },
        },
      ],
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
          user,
          requestMetadata,
          data: {
            changes: diffDocumentMetaChanges(originalDocumentMeta ?? {}, upsertedDocumentMeta),
          },
        }),
      });
    }

    return upsertedDocumentMeta;
  });
};
