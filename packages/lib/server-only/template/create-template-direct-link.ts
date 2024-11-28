'use server';

import { nanoid } from 'nanoid';

import {
  DIRECT_TEMPLATE_RECIPIENT_EMAIL,
  DIRECT_TEMPLATE_RECIPIENT_NAME,
} from '@documenso/lib/constants/direct-templates';
import { prisma } from '@documenso/prisma';
import type { Recipient, TemplateDirectLink } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type CreateTemplateDirectLinkOptions = {
  templateId: number;
  userId: number;
  directRecipientId?: number;
};

export const createTemplateDirectLink = async ({
  templateId,
  userId,
  directRecipientId,
}: CreateTemplateDirectLinkOptions): Promise<TemplateDirectLink> => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
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
    include: {
      Recipient: true,
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
    !template.Recipient.find((recipient) => recipient.id === directRecipientId)
  ) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Recipient not found' });
  }

  if (
    !directRecipientId &&
    template.Recipient.find(
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
