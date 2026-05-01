import type { DocumentDataType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type CreateDocumentDataOptions = {
  type: DocumentDataType;
  data: string;

  /**
   * The initial data that was used to create the document data.
   *
   * If not provided, the current data will be used.
   */
  initialData?: string;
  originalData?: string;
  originalMimeType?: string;
};

export const createDocumentData = async ({
  type,
  data,
  initialData,
  originalData,
  originalMimeType,
}: CreateDocumentDataOptions) => {
  return await prisma.documentData.create({
    data: {
      type,
      data,
      initialData: initialData || data,
      originalData,
      originalMimeType,
    },
  });
};
