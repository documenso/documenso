import sharp from 'sharp';
import { match } from 'ts-pattern';

import { AppError } from '../../errors/app-error';
import type { TDataContentImageMeta } from '../../types/data-content-meta';

/**
 * The longest edge an uploaded content image is scaled down to, in pixels.
 *
 * Content images are drawn at page scale, so anything beyond this only
 * inflates storage and render times without a visible difference.
 */
export const CONTENT_IMAGE_MAX_EDGE = 2048;

/**
 * The longest file name kept for an uploaded content image.
 *
 * The name is stored verbatim and echoed back in the `Content-Disposition`
 * header of every request for the image, so it is capped to keep the header
 * within what proxies accept.
 */
export const CONTENT_IMAGE_MAX_FILE_NAME_LENGTH = 200;

/**
 * The maximum number of pixels an uploaded image may decode to.
 *
 * Bounds the memory used to decode an upload, since a tiny compressed file
 * can expand to a huge bitmap. Comfortably fits a 12 megapixel phone photo.
 */
export const CONTENT_IMAGE_MAX_INPUT_PIXELS = 25_000_000;

type SupportedImageFormat = 'png' | 'jpeg' | 'webp';

const SUPPORTED_IMAGE_FORMATS: ReadonlySet<string> = new Set<SupportedImageFormat>(['png', 'jpeg', 'webp']);

const isSupportedImageFormat = (format: string | undefined): format is SupportedImageFormat =>
  format !== undefined && SUPPORTED_IMAGE_FORMATS.has(format);

export type NormalizeImageOptions = {
  maxEdge?: number;
  maxInputPixels?: number;
};

export type NormalizedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: TDataContentImageMeta['mimeType'];
};

/**
 * Validate and normalize an uploaded image for use as content.
 *
 * - Only PNG, JPEG and WebP are accepted, verified against the decoded bytes
 *   rather than the client supplied MIME type. Notably this excludes SVG.
 * - The EXIF orientation is applied so the pixels match how the image is
 *   displayed, then all metadata (including EXIF and GPS) is stripped.
 * - Images larger than `maxEdge` are scaled down, preserving aspect ratio.
 *
 * The original format is kept so photos stay compact as JPEG while graphics
 * with transparency stay lossless as PNG.
 */
export const normalizeImage = async (
  input: Buffer | Uint8Array,
  { maxEdge = CONTENT_IMAGE_MAX_EDGE, maxInputPixels = CONTENT_IMAGE_MAX_INPUT_PIXELS }: NormalizeImageOptions = {},
): Promise<NormalizedImage> => {
  const image = sharp(input, { limitInputPixels: maxInputPixels });

  // Reading the metadata only parses the header, so an unsupported or
  // malformed file is rejected before any pixels are decoded.
  const metadata = await image.metadata().catch((error) => {
    throw new AppError('INVALID_IMAGE_FILE', {
      message: `Unable to read image: ${error instanceof Error ? error.message : 'unknown error'}`,
    });
  });

  if (!isSupportedImageFormat(metadata.format)) {
    throw new AppError('INVALID_IMAGE_FILE', {
      message: `Unsupported image format: ${metadata.format ?? 'unknown'}`,
    });
  }

  const format = metadata.format;

  const { data, info } = await image
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toFormat(format)
    .toBuffer({ resolveWithObject: true })
    .catch((error) => {
      throw new AppError('INVALID_IMAGE_FILE', {
        message: `Unable to process image: ${error instanceof Error ? error.message : 'unknown error'}`,
      });
    });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    mimeType: match(format)
      .with('png', () => 'image/png' as const)
      .with('jpeg', () => 'image/jpeg' as const)
      .with('webp', () => 'image/webp' as const)
      .exhaustive(),
  };
};

/**
 * Derive a file name whose extension matches the normalized format, since
 * the upload may have been re-encoded.
 */
export const getNormalizedImageFileName = (fileName: string, mimeType: NormalizedImage['mimeType']) => {
  const extension = match(mimeType)
    .with('image/png', () => 'png')
    .with('image/jpeg', () => 'jpg')
    .with('image/webp', () => 'webp')
    .exhaustive();

  const baseName = fileName
    .replace(/\.(png|jpe?g|webp)$/i, '')
    // The name is served back in a `Content-Disposition` header, so control
    // characters are replaced and the length is capped to keep the header
    // small enough for proxies to accept.
    .replace(/\s+/g, ' ')
    .slice(0, CONTENT_IMAGE_MAX_FILE_NAME_LENGTH);

  return `${baseName}.${extension}`;
};
