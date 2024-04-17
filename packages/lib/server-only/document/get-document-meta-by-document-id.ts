import { prisma } from '@documenso/prisma';

export interface GetDocumentMetaByDocumentIdOptions {
  id: number;
}

export const getDocumentMetaByDocumentId = async ({ id }: GetDocumentMetaByDocumentIdOptions) => {
  return await prisma.documentMeta.findFirstOrThrow({
    where: {
      documentId: id,
    },
  });
};
