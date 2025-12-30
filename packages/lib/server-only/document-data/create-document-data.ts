import type { DocumentDataType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type CreateDocumentDataOptions = {
  type: DocumentDataType;
  data: string;
  originalData?: string;
  originalMimeType?: string;
};

export const createDocumentData = async ({
  type,
  data,
  originalData,
  originalMimeType,
}: CreateDocumentDataOptions) => {
  return await prisma.documentData.create({
    data: {
      type,
      data,
      initialData: data,
      originalData,
      originalMimeType,
    },
  });
};
