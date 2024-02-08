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
        dateFormat,
        timezone,
        password,
        documentId,
      },
      update: {
        subject,
        message,
        dateFormat,
        password,
        timezone,
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        documentId,
        user,
        requestMetadata,
        data: {
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_META_UPDATED,
          changes: diffDocumentMetaChanges(originalDocumentMeta ?? {}, upsertedDocumentMeta),
        },
      }),
    });

    return upsertedDocumentMeta;
  });
};
