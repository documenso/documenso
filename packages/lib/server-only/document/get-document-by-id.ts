import { prisma } from '@documenso/prisma';

export interface GetDocumentByIdOptions {
  id: number;
  userId: string;
}

export const getDocumentById = async ({ id, userId }: GetDocumentByIdOptions) => {
  return await prisma.document.findFirstOrThrow({
    where: {
      id,
      userId,
    },
  });
};
