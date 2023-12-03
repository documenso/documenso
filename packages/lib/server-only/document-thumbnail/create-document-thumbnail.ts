'use server';

import { prisma } from '@documenso/prisma';

export type CreateDocumentThumbnailOptions = {
  highResThumbnailBytes: string;
  lowResThumbnailBytes: string;
};

export const createDocumentThumbnail = async ({
  highResThumbnailBytes,
  lowResThumbnailBytes,
}: CreateDocumentThumbnailOptions) => {
  return await prisma.documentThumbnail.create({
    data: {
      highResThumbnailBytes,
      lowResThumbnailBytes,
    },
  });
};
