import { prisma } from '@documenso/prisma';

export interface GetTemplateByIdOptions {
  id: number;
  userId: number;
}

export const getTemplateById = async ({ id, userId }: GetTemplateByIdOptions) => {
  return await prisma.template.findFirstOrThrow({
    where: {
      id,
      userId,
    },
    include: {
      templateDocumentData: true,
    },
  });
};
