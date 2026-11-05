import sharp from 'sharp';
import { match } from 'ts-pattern';

import { CONTENT_IMAGE_MAX_EDGE, CONTENT_IMAGE_MAX_INPUT_PIXELS } from '../../constants/envelope-content';
import { AppError } from '../../errors/app-error';
import type { TDataContentImageMeta } from '../../types/data-content-meta';

/**
 * In UTF-16 code units to match the `fileName` limit in `ZDataContentImageMeta`,
 * which Zod also checks against `length`. The extension is added on top.
 */
export const CONTENT_IMAGE_MAX_FILE_NAME_LENGTH = 200;

export const CONTENT_IMAGE_FALLBACK_FILE_NAME = 'image';

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
 * The format is verified against the decoded bytes rather than the client
 * supplied MIME type, and SVG is deliberately excluded. All metadata
 * (including EXIF and GPS) is stripped after the orientation is applied.
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

export const getNormalizedImageFileName = (fileName: string, mimeType: NormalizedImage['mimeType']) => {
  const extension = match(mimeType)
    .with('image/png', () => 'png')
    .with('image/jpeg', () => 'jpg')
    .with('image/webp', () => 'webp')
    .exhaustive();

  const baseName = fileName
    // A NUL byte is rejected by Postgres jsonb and would fail the metadata
    // insert. Whitespace controls are left for the collapse below.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
    .replace(/[\u0000-\u0008\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // The extension is stripped after trimming so a name with trailing
    // whitespace ("photo.png ") does not end up as "photo.png.png".
    .replace(/\.(png|jpe?g|webp)$/i, '')
    .trim();

  const truncatedBaseName = truncateWithoutSplittingSurrogates(baseName, CONTENT_IMAGE_MAX_FILE_NAME_LENGTH);

  const finalBaseName = truncatedBaseName === '' ? CONTENT_IMAGE_FALLBACK_FILE_NAME : truncatedBaseName;

  return `${finalBaseName}.${extension}`;
};

/**
 * A naive slice can split a surrogate pair and leave a lone surrogate, which
 * Postgres jsonb rejects.
 */
const truncateWithoutSplittingSurrogates = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  const lastCodeUnit = value.charCodeAt(maxLength - 1);

  const isHighSurrogate = lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff;

  return value.slice(0, isHighSurrogate ? maxLength - 1 : maxLength);
};
