'use server';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

export type UpdateTitleOptions = {
  userId: number;
  documentId: number;
  title: string;
  requestMetadata?: RequestMetadata;
};

export const updateTitle = async ({
  userId,
  documentId,
  title,
  requestMetadata,
}: UpdateTitleOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  return await prisma.$transaction(async (tx) => {
    const document = await tx.document.findFirstOrThrow({
      where: {
        id: documentId,
        OR: [
          {
            userId,
          },
          {
            team: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
        ],
      },
    });

    if (document.title === title) {
      return document;
    }

    const updatedDocument = await tx.document.update({
      where: {
        id: documentId,
      },
      data: {
        title,
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_TITLE_UPDATED,
        documentId,
        user,
        requestMetadata,
        data: {
          from: document.title,
          to: updatedDocument.title,
        },
      }),
    });

    return updatedDocument;
  });
};
