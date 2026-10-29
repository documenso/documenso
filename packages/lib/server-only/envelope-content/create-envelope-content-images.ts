import type { DataContent } from '@prisma/client';
import pMap from 'p-map';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DataContentType } from '../../types/data-content-meta';
import { CONTENT_TYPE_DATA_CONTENT_TYPE, type EnvelopeContentType } from '../../types/envelope-content-meta';
import { createDataContentImage } from '../data-content/create-data-content-image';

export type CreateEnvelopeContentImagesOptions = {
  /**
   * The contents being saved. A content references its image by the index of
   * the image in `images`.
   */
  contents: {
    contentMeta: {
      type: EnvelopeContentType;
    };
    imageIndex?: number;
  }[];

  /**
   * The images uploaded alongside the contents.
   */
  images: File[];
};

/**
 * Store the images uploaded alongside a batch of contents, for callers which
 * cannot upload each image as it is picked through `uploadEnvelopeContentImage`,
 * e.g. the embedded editor which only saves when the envelope is created or
 * updated.
 *
 * Each image is stored once however many contents reference it (e.g. a
 * duplicated image content), and images no content references are ignored.
 *
 * Returns the created data contents by image index. They are not attached to
 * anything yet, pass them to `setEnvelopeContents` as `newDataContents` or
 * create the contents with them directly.
 */
export const createEnvelopeContentImages = async ({ contents, images }: CreateEnvelopeContentImagesOptions) => {
  const imageIndexes = new Set<number>();

  // Validate every reference before storing anything.
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
