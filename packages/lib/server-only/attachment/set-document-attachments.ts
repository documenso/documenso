import type { Attachment, User } from '@prisma/client';

import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';
import { AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { buildTeamWhereQuery } from '../../utils/teams';

export type CreateAttachmentsOptions = {
  documentId: number;
  attachments: Pick<Attachment, 'id' | 'label' | 'url' | 'type'>[];
  user: Pick<User, 'id' | 'email' | 'name'>;
  teamId: number;
  requestMetadata: RequestMetadata;
};

export const setDocumentAttachments = async ({
  documentId,
  attachments,
  user,
  teamId,
  requestMetadata,
}: CreateAttachmentsOptions) => {
  const document = await prisma.document.findUnique({
    where: {
      id: documentId,
      team: buildTeamWhereQuery({ teamId, userId: user.id }),
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const existingAttachments = await prisma.attachment.findMany({
    where: {
      documentId,
    },
  });

  const newIds = attachments.map((a) => a.id).filter(Boolean);
  const toDelete = existingAttachments.filter((existing) => !newIds.includes(existing.id));

  if (toDelete.length > 0) {
    await prisma.attachment.deleteMany({
      where: {
        id: { in: toDelete.map((a) => a.id) },
      },
    });
  }

  const upsertedAttachments: Attachment[] = [];

  for (const attachment of attachments) {
    const updated = await prisma.attachment.upsert({
      where: { id: attachment.id, documentId: document.id },
      update: {
        label: attachment.label,
        url: attachment.url,
        type: attachment.type,
      },
      create: {
        label: attachment.label,
        url: attachment.url,
        type: attachment.type,
        documentId,
      },
    });
    upsertedAttachments.push(updated);
  }

  const isAttachmentsSame = upsertedAttachments.every((attachment) => {
    const existingAttachment = existingAttachments.find((a) => a.id === attachment.id);
    return (
      existingAttachment?.label === attachment.label &&
      existingAttachment?.url === attachment.url &&
      existingAttachment?.type === attachment.type
    );
  });

  if (!isAttachmentsSame) {
    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ATTACHMENTS_UPDATED,
        documentId: document.id,
        user,
        data: {
          from: existingAttachments,
          to: upsertedAttachments,
        },
        requestMetadata,
      }),
    });
  }

  return upsertedAttachments;
};
