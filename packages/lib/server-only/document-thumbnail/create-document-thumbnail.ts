'use server';

import { prisma } from '@documenso/prisma';

export type ThumbnailData = {
  thumbnailData: Buffer;
  thubmnailHQData: Buffer;
};

export const createThumbnailData = async (data: ThumbnailData) => {
  return await prisma.documentThumbnail.create({
    data: {
      thumbnail_bytes: data.thumbnailData,
      hq_thumbnail_bytes: data.thubmnailHQData,
    },
  });
};
