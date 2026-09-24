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
 * The longest file name kept for an uploaded content image, in UTF-16 code
 * units (i.e. `String.prototype.length`).
 *
 * The name is stored in the data content's metadata and used to name the
 * stored file, so it is capped to keep both bounded. Measured in code units
 * to match the `fileName` limit in `ZDataContentImageMeta`, which Zod also
 * checks against `length`. The extension is added on top of this cap.
 */
export const CONTENT_IMAGE_MAX_FILE_NAME_LENGTH = 200;

/**
 * The file name used when nothing usable is left of the uploaded name.
 */
export const CONTENT_IMAGE_FALLBACK_FILE_NAME = 'image';

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
    // Non-whitespace control characters are stripped. Besides being
    // meaningless in a file name, a NUL byte is rejected by Postgres jsonb
    // and would fail the metadata insert. Whitespace controls (tab, CR, LF,
    // VT, FF) are left for the collapse below.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
    .replace(/[\u0000-\u0008\u000E-\u001F\u007F]/g, '')
    // Runs of whitespace are collapsed and the length is capped below to keep
    // the stored name tidy and bounded.
    .replace(/\s+/g, ' ')
    .trim()
    // The extension is stripped after trimming so a name with trailing
    // whitespace ("photo.png ") does not end up as "photo.png.png".
    .replace(/\.(png|jpe?g|webp)$/i, '')
    .trim();

  const truncatedBaseName = truncateWithoutSplittingSurrogates(baseName, CONTENT_IMAGE_MAX_FILE_NAME_LENGTH);

  // A name such as ".png" or one made entirely of control characters leaves
  // nothing behind, which would otherwise produce a bare ".png".
  const finalBaseName = truncatedBaseName === '' ? CONTENT_IMAGE_FALLBACK_FILE_NAME : truncatedBaseName;

  return `${finalBaseName}.${extension}`;
};

/**
 * Truncate a string to at most `maxLength` UTF-16 code units without cutting
 * a surrogate pair in half.
 *
 * `String.prototype.slice` counts code units, so a naive slice can split an
 * astral character (e.g. an emoji) and leave a lone surrogate, which Postgres
 * jsonb rejects. Counting code units rather than code points keeps the result
 * within the `length` based limit Zod enforces on the stored file name.
 */
const truncateWithoutSplittingSurrogates = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  const lastCodeUnit = value.charCodeAt(maxLength - 1);

  // A high surrogate at the cut point means the next unit is its low
  // surrogate, so back up one to drop the whole pair.
  const isHighSurrogate = lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff;

  return value.slice(0, isHighSurrogate ? maxLength - 1 : maxLength);
};
