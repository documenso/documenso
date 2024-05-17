'use server';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type ToggleTemplateDirectAccessOptions = {
  templateId: number;
  userId: number;
  enabled: boolean;
};

export const toggleTemplateDirectAccess = async ({
  templateId,
  userId,
  enabled,
}: ToggleTemplateDirectAccessOptions) => {
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
      access: true,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, 'Template not found');
  }

  const { access } = template;

  if (!access) {
    throw new AppError(AppErrorCode.NOT_FOUND, 'Direct template access not found');
  }

  return await prisma.templateDirectAccess.update({
    where: {
      id: access.id,
    },
    data: {
      templateId: template.id,
      enabled,
    },
  });
};
