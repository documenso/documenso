import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface DeleteTemplateFieldOptions {
  userId: number;
  teamId?: number;
  fieldId: number;
}

export const deleteTemplateField = async ({
  userId,
  teamId,
  fieldId,
}: DeleteTemplateFieldOptions): Promise<void> => {
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
      template: teamId
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
          },
    },
  });

  if (!field || !field.templateId) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Field not found',
    });
  }

  await prisma.field.delete({
    where: {
      id: fieldId,
    },
  });
};
