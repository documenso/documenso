import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type GetTemplateByIdOptions = {
  id: number;
  userId: number;
  teamId?: number;
};

export const getTemplateById = async ({ id, userId, teamId }: GetTemplateByIdOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id,
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
      directLink: true,
      templateDocumentData: true,
      templateMeta: true,
      recipients: true,
      fields: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  return template;
};
