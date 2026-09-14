import { Image as SkiaImage } from '@documenso/skia-canvas';

import { AppError } from '../../errors/app-error';
import type { ContentImageSource } from '../../universal/content-renderer/content-renderer';

/**
 * Decode image bytes into a skia-canvas image which Konva can draw when
 * rendering on the server.
 *
 * Decoding is synchronous, so the resulting image is immediately usable.
 */
export const createSkiaImage = (bytes: Uint8Array): ContentImageSource => {
  try {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return new SkiaImage(Buffer.from(bytes)) as unknown as ContentImageSource;
  } catch (error) {
    throw new AppError('INVALID_IMAGE_FILE', {
      message: `Unable to decode image: ${error instanceof Error ? error.message : 'unknown error'}`,
    });
  }
};
