import { prisma } from '@documenso/prisma';

export interface getDocumentMetaByDocumentIdOptions {
  id: number;
}

export const getDocumentMetaByDocumentId = async ({ id }: getDocumentMetaByDocumentIdOptions) => {
  return await prisma.documentMeta.findFirstOrThrow({
    where: {
      documentId: id,
    },
  });
};
