'use server';

import { prisma } from '@documenso/prisma';
import { DocumentDataType } from '@documenso/prisma/client';

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
