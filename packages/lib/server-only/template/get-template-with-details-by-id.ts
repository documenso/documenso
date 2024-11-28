import { prisma } from '@documenso/prisma';
import type { TemplateWithDetails } from '@documenso/prisma/types/template';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type GetTemplateWithDetailsByIdOptions = {
  id: number;
  userId: number;
};

export const getTemplateWithDetailsById = async ({
  id,
  userId,
}: GetTemplateWithDetailsByIdOptions): Promise<TemplateWithDetails> => {
  const template = await prisma.template.findFirst({
    where: {
      id,
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
      templateDocumentData: true,
      templateMeta: true,
      Recipient: true,
      Field: true,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  return template;
};
