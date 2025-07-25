import type { Attachment } from '@prisma/client';

import { AppError } from '@documenso/lib/errors/app-error';
import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZSetTemplateAttachmentsResponseSchema,
  ZSetTemplateAttachmentsSchema,
} from './set-template-attachments.types';

export const setTemplateAttachmentsRoute = authenticatedProcedure
  .input(ZSetTemplateAttachmentsSchema)
  .output(ZSetTemplateAttachmentsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { templateId, attachments } = input;

    const updatedAttachments = await setTemplateAttachments({
      templateId,
      userId: ctx.user.id,
      teamId: ctx.teamId,
      attachments,
    });

    return updatedAttachments;
  });

export type CreateAttachmentsOptions = {
  templateId: number;
  attachments: Pick<Attachment, 'id' | 'label' | 'url' | 'type'>[];
  userId: number;
  teamId: number;
};

export const setTemplateAttachments = async ({
  templateId,
  attachments,
  userId,
  teamId,
}: CreateAttachmentsOptions) => {
  const template = await prisma.template.findUnique({
    where: {
      id: templateId,
      team: buildTeamWhereQuery({ teamId, userId }),
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
    const updated = await prisma.attachment.upsert({
      where: { id: attachment.id, templateId: template.id },
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
  }

  return upsertedAttachments;
};
