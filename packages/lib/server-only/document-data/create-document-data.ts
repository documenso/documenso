import type { DocumentDataType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type CreateDocumentDataOptions = {
  type: DocumentDataType;
  data: string;
};

export const createDocumentData = async ({ type, data }: CreateDocumentDataOptions) => {
  return await prisma.documentData.create({
    data: {
      type,
      data,
      initialData: data,
    },
  });
};
