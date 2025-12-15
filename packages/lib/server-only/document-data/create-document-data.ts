import type { DocumentDataType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type CreateDocumentDataOptions = {
  type: DocumentDataType;
  data: string;
  originalMimeType?: string;
};

export const createDocumentData = async ({
  type,
  data,
  originalMimeType,
}: CreateDocumentDataOptions) => {
  return await prisma.documentData.create({
    data: {
      type,
      data,
      initialData: data,
      originalMimeType,
    },
  });
};
