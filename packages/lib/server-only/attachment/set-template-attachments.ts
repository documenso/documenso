import type { Attachment } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';
import { AppErrorCode } from '../../errors/app-error';

export type CreateAttachmentsOptions = {
  templateId: number;
  attachments: Pick<Attachment, 'id' | 'label' | 'url' | 'type'>[];
};

export const setTemplateAttachments = async ({
  templateId,
  attachments,
}: CreateAttachmentsOptions) => {
  const template = await prisma.template.findUnique({
    where: {
      id: templateId,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  const existingAttachments = await prisma.attachment.findMany({
    where: {
      templateId,
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
        },
      });
      upsertedAttachments.push(created);
    }
  }

  return upsertedAttachments;
};
