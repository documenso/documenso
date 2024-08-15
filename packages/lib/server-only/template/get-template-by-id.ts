import { prisma } from '@documenso/prisma';
import type { Prisma } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface GetTemplateByIdOptions {
  id: number;
  userId: number;
  teamId?: number;
}

export const getTemplateById = async ({ id, userId, teamId }: GetTemplateByIdOptions) => {
  const whereFilter: Prisma.TemplateWhereInput = {
    id,
    OR:
      teamId === undefined
        ? [
            {
              userId,
              teamId: null,
            },
          ]
        : [
            {
              teamId,
              team: {
                members: {
                  some: {
                    userId,
                  },
                },
              },
            },
          ],
  };

  const template = await prisma.template.findFirst({
    where: whereFilter,
    include: {
      directLink: true,
      templateDocumentData: true,
      templateMeta: true,
      Recipient: true,
      Field: true,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, 'Template not found');
  }

  return template;
};
