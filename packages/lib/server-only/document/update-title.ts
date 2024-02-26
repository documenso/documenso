'use server';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

export type UpdateTitleOptions = {
  userId: number;
  teamId?: number;
  documentId: number;
  title: string;
  requestMetadata?: RequestMetadata;
};

export const updateTitle = async ({
  userId,
  teamId,
  documentId,
  title,
  requestMetadata,
}: UpdateTitleOptions) => {
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

  if (document.title === title) {
    return document;
  }

  return await prisma.$transaction(async (tx) => {
    // Instead of doing everything in a transaction we can use our knowledge
    // of the current document title to ensure we aren't performing a conflicting
    // update.
    const updatedDocument = await tx.document.update({
      where: {
        id: documentId,
        title: document.title,
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
