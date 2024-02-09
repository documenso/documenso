'use server';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

export type CreateDocumentOptions = {
  title: string;
  userId: number;
  teamId?: number;
  documentDataId: string;
  requestMetadata?: RequestMetadata;
};

export const createDocument = async ({
  userId,
  title,
  documentDataId,
  teamId,
  requestMetadata,
}: CreateDocumentOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    include: {
      teamMembers: {
        select: {
          teamId: true,
        },
      },
    },
  });

  if (
    teamId !== undefined &&
    !user.teamMembers.some((teamMember) => teamMember.teamId === teamId)
  ) {
    throw new AppError(AppErrorCode.NOT_FOUND, 'Team not found');
  }

  return await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        title,
        documentDataId,
        userId,
        teamId,
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
        documentId: document.id,
        user,
        requestMetadata,
        data: {
          title,
        },
      }),
    });

    return document;
  });
};
