import { prisma } from '@documenso/prisma';

export interface GetDocumentMetaByIdOptions {
  id: number;
}

export const getDocumentMetaById = async ({ id }: GetDocumentMetaByIdOptions) => {
  return await prisma.documentMeta.findFirstOrThrow({
    where: {
      documentId: id,
    },
  });
};
