import type { DataContent } from '@prisma/client';
import pMap from 'p-map';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DataContentType } from '../../types/data-content-meta';
import { CONTENT_TYPE_DATA_CONTENT_TYPE, type EnvelopeContentType } from '../../types/envelope-content-meta';
import { createDataContentImage } from '../data-content/create-data-content-image';

export type CreateEnvelopeContentImagesOptions = {
  contents: {
    contentMeta: {
      type: EnvelopeContentType;
    };
    imageIndex?: number;
  }[];
  images: File[];
};

/**
 * For callers which cannot upload each image as it is picked through
 * `uploadEnvelopeContentImage`, e.g. the embedded editor which only saves when
 * the envelope is created or updated.
 */
export const createEnvelopeContentImages = async ({ contents, images }: CreateEnvelopeContentImagesOptions) => {
  const imageIndexes = new Set<number>();

  for (const content of contents) {
    if (content.imageIndex === undefined) {
      continue;
    }

    if (CONTENT_TYPE_DATA_CONTENT_TYPE[content.contentMeta.type] !== DataContentType.IMAGE) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `A ${content.contentMeta.type} content cannot hold an image`,
      });
    }

    if (!images[content.imageIndex]) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Invalid content image index',
      });
    }

    imageIndexes.add(content.imageIndex);
  }

  const dataContents = await pMap(
    imageIndexes,
    async (imageIndex) => [imageIndex, await createDataContentImage({ file: images[imageIndex] })] as const,
    // Normalizing an image is CPU heavy, so only a couple run at once.
    { concurrency: 2 },
  );

  return new Map<number, DataContent>(dataContents);
};
