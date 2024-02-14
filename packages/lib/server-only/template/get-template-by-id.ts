import { prisma } from '@documenso/prisma';
import type { Prisma } from '@documenso/prisma/client';

export interface GetTemplateByIdOptions {
  id: number;
  userId: number;
}

export const getTemplateById = async ({ id, userId }: GetTemplateByIdOptions) => {
  const whereFilter: Prisma.TemplateWhereInput = {
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
  };

  return await prisma.template.findFirstOrThrow({
    where: whereFilter,
    include: {
      templateDocumentData: true,
    },
  });
};
