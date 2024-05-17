'use server';

import { generateAvaliableRecipientPlaceholder } from '@documenso/lib/utils/templates';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type DeleteTemplateDirectAccessOptions = {
  templateId: number;
  userId: number;
};

export const deleteTemplateDirectAccess = async ({
  templateId,
  userId,
}: DeleteTemplateDirectAccessOptions): Promise<void> => {
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
      access: true,
      Recipient: true,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, 'Template not found');
  }

  const { access } = template;

  if (!access) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.recipient.update({
      where: {
        templateId: template.id,
        id: access.directTemplateRecipientId,
      },
      data: {
        ...generateAvaliableRecipientPlaceholder(template.Recipient),
      },
    });

    await tx.templateDirectAccess.delete({
      where: {
        templateId,
      },
    });
  });
};
