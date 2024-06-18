'use server';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type ToggleTemplateDirectLinkOptions = {
  templateId: number;
  userId: number;
  enabled: boolean;
};

export const toggleTemplateDirectLink = async ({
  templateId,
  userId,
  enabled,
}: ToggleTemplateDirectLinkOptions) => {
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
    throw new AppError(AppErrorCode.NOT_FOUND, 'Template not found');
  }

  const { directLink } = template;

  if (!directLink) {
    throw new AppError(AppErrorCode.NOT_FOUND, 'Direct template link not found');
  }

  return await prisma.templateDirectLink.update({
    where: {
      id: directLink.id,
    },
    data: {
      templateId: template.id,
      enabled,
    },
  });
};
