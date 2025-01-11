import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface DeleteTemplateRecipientOptions {
  userId: number;
  teamId?: number;
  recipientId: number;
}

export const deleteTemplateRecipient = async ({
  userId,
  teamId,
  recipientId,
}: DeleteTemplateRecipientOptions): Promise<void> => {
  const template = await prisma.template.findFirst({
    where: {
      recipients: {
        some: {
          id: recipientId,
        },
      },
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
    include: {
      recipients: {
        where: {
          id: recipientId,
        },
      },
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  const recipientToDelete = template.recipients[0];

  if (!recipientToDelete || recipientToDelete.id !== recipientId) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  await prisma.recipient.delete({
    where: {
      id: recipientId,
    },
  });
};
