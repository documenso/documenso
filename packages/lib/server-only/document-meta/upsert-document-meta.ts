'use server';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import {
  createDocumentAuditLogData,
  diffDocumentMetaChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

export type CreateDocumentMetaOptions = {
  documentId: number;
  subject?: string;
  message?: string;
  timezone?: string;
  password?: string;
  dateFormat?: string;
  redirectUrl?: string;
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
      },
      update: {
        subject,
        message,
        password,
        dateFormat,
        timezone,
        redirectUrl,
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
