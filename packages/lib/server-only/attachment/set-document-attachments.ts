import type { Attachment } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';
import { AppErrorCode } from '../../errors/app-error';

export type CreateAttachmentsOptions = {
  documentId?: number;
  templateId?: number;
  attachments: Pick<Attachment, 'id' | 'label' | 'url' | 'type'>[];
};

export const setDocumentAttachments = async ({
  documentId,
  templateId,
  attachments,
}: CreateAttachmentsOptions) => {
  const document = await prisma.document.findUnique({
    where: {
      id: documentId,
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
    if (attachment.id) {
      const updated = await prisma.attachment.upsert({
        where: { id: attachment.id },
        update: {
          label: attachment.label,
          url: attachment.url,
          type: attachment.type,
          templateId,
        },
        create: {
          label: attachment.label,
          url: attachment.url,
          type: attachment.type,
          templateId,
          documentId,
        },
      });
      upsertedAttachments.push(updated);
    } else {
      const created = await prisma.attachment.create({
        data: {
          label: attachment.label,
          url: attachment.url,
          type: attachment.type,
          templateId,
          documentId,
        },
      });
      upsertedAttachments.push(created);
    }
  }

  return upsertedAttachments;
};
