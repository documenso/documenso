import type { Recipient } from '@prisma/client';
import { nanoid } from 'nanoid';

import {
  DIRECT_TEMPLATE_RECIPIENT_EMAIL,
  DIRECT_TEMPLATE_RECIPIENT_NAME,
} from '@documenso/lib/constants/direct-templates';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';

export type CreateTemplateDirectLinkOptions = {
  templateId: number;
  userId: number;
  teamId: number;
  directRecipientId?: number;
};

export const createTemplateDirectLink = async ({
  templateId,
  userId,
  teamId,
  directRecipientId,
}: CreateTemplateDirectLinkOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      team: buildTeamWhereQuery(teamId, userId),
    },
    include: {
      recipients: true,
      directLink: true,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Template not found' });
  }

  if (template.directLink) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, { message: 'Direct template already exists' });
  }

  if (
    directRecipientId &&
    !template.recipients.find((recipient) => recipient.id === directRecipientId)
  ) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Recipient not found' });
  }

  if (
    !directRecipientId &&
    template.recipients.find(
      (recipient) => recipient.email.toLowerCase() === DIRECT_TEMPLATE_RECIPIENT_EMAIL,
    )
  ) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Cannot generate placeholder direct recipient',
    });
  }

  return await prisma.$transaction(async (tx) => {
    let recipient: Recipient | undefined;

    if (directRecipientId) {
      recipient = await tx.recipient.update({
        where: {
          templateId,
          id: directRecipientId,
        },
        data: {
          name: DIRECT_TEMPLATE_RECIPIENT_NAME,
          email: DIRECT_TEMPLATE_RECIPIENT_EMAIL,
        },
      });
    } else {
      recipient = await tx.recipient.create({
        data: {
          templateId,
          name: DIRECT_TEMPLATE_RECIPIENT_NAME,
          email: DIRECT_TEMPLATE_RECIPIENT_EMAIL,
          token: nanoid(),
        },
      });
    }

    return await tx.templateDirectLink.create({
      data: {
        templateId,
        enabled: true,
        token: nanoid(),
        directTemplateRecipientId: recipient.id,
      },
    });
  });
};
