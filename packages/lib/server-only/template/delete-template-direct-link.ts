'use server';

import { generateAvaliableRecipientPlaceholder } from '@documenso/lib/utils/templates';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type DeleteTemplateDirectLinkOptions = {
  templateId: number;
  userId: number;
};

export const deleteTemplateDirectLink = async ({
  templateId,
  userId,
}: DeleteTemplateDirectLinkOptions): Promise<void> => {
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
      directLink: true,
      Recipient: true,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, 'Template not found');
  }

  const { directLink } = template;

  if (!directLink) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.recipient.update({
      where: {
        templateId: template.id,
        id: directLink.directTemplateRecipientId,
      },
      data: {
        ...generateAvaliableRecipientPlaceholder(template.Recipient),
      },
    });

    await tx.templateDirectLink.delete({
      where: {
        templateId,
      },
    });
  });
};
