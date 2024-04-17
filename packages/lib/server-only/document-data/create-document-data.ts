'use server';

import { prisma } from '@documenso/prisma';
<<<<<<< HEAD
import { DocumentDataType } from '@documenso/prisma/client';
=======
import type { DocumentDataType } from '@documenso/prisma/client';
>>>>>>> main

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
