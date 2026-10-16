import { CONTENT_IMAGE_MAX_EDGE, CONTENT_IMAGE_MAX_INPUT_PIXELS } from '../constants/envelope-content';
import { AppError } from '../errors/app-error';
import type { ContentImageSource } from '../universal/content-renderer/content-renderer';

type LoadContentImageDependencies = {
  fetch: (url: string) => Promise<Response>;
  createImageBitmap: (blob: Blob) => Promise<ImageBitmap>;
};

const defaultDependencies = (): LoadContentImageDependencies => ({
  fetch: async (url) => await fetch(url),
  createImageBitmap: async (blob) => await createImageBitmap(blob),
});

/**
 * What is known about a content image's file, for display.
 */
export type ContentImageDetails = {
  /**
   * The size of the stored bytes.
   */
  fileSize: number;
};

export type LoadedContentImage = {
  image: ContentImageSource;
  details: ContentImageDetails;
};

/**
 * Fetch and decode a content image, retrying once after a network or server
 * error. Client errors (e.g. not found) fail immediately.
 *
 * The image is decoded off the main thread into an `ImageBitmap`, which is
 * what the canvas renderer wants and carries no cross origin taint.
 */
export const loadContentImage = async (
  url: string,
  dependencies: LoadContentImageDependencies = defaultDependencies(),
): Promise<LoadedContentImage> => {
  try {
    return await fetchAndDecode(url, dependencies);
  } catch (error) {
    if (!isRetryable(error)) {
      throw error;
    }

    return await fetchAndDecode(url, dependencies);
  }
};

/**
 * Decode an image file which has not been uploaded, as the server would store
 * it: oriented and scaled down to `CONTENT_IMAGE_MAX_EDGE`.
 *
 * Used where an image is held on the client until the envelope is saved,
 * e.g. in the embedded editor. Throws `INVALID_IMAGE_FILE` for anything the
 * server would reject once decoded.
 */
export const decodeLocalContentImage = async (file: Blob): Promise<LoadedContentImage> => {
  if (!(await hasSupportedImageSignature(file))) {
    throw new AppError('INVALID_IMAGE_FILE');
  }

  // Browsers apply the EXIF orientation by default. Asking for it with
  // `imageOrientation: 'from-image'` would fail in browsers older than
  // Chrome 112, Firefox 111 and Safari 16, which call it `'none'`.
  const decoded = await createImageBitmap(file).catch(() => {
    throw new AppError('INVALID_IMAGE_FILE');
  });

  if (decoded.width * decoded.height > CONTENT_IMAGE_MAX_INPUT_PIXELS) {
    decoded.close();

    throw new AppError('INVALID_IMAGE_FILE');
  }

  const scale = Math.min(1, CONTENT_IMAGE_MAX_EDGE / Math.max(decoded.width, decoded.height));

  if (scale === 1) {
    return {
      image: decoded,
      details: {
        fileSize: file.size,
      },
    };
  }

  const resized = await createImageBitmap(decoded, {
    resizeWidth: Math.max(1, Math.round(decoded.width * scale)),
    resizeHeight: Math.max(1, Math.round(decoded.height * scale)),
    resizeQuality: 'high',
  }).finally(() => decoded.close());

  return {
    image: resized,
    details: {
      fileSize: file.size,
    },
  };
};

type ContentImageResponseError = Error & { status: number };

const createResponseError = (status: number): ContentImageResponseError =>
  Object.assign(new Error(`Failed to load content image (${status})`), { status });

const isResponseError = (error: unknown): error is ContentImageResponseError =>
  error instanceof Error && 'status' in error && typeof error.status === 'number';

const fetchAndDecode = async (
  url: string,
  { fetch, createImageBitmap }: LoadContentImageDependencies,
): Promise<LoadedContentImage> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw createResponseError(response.status);
  }

  const blob = await response.blob();

  return {
    image: await createImageBitmap(blob),
    details: {
      fileSize: blob.size,
    },
  };
};

/**
 * Network failures surface as thrown `TypeError`s, and server errors are
 * worth one more attempt. Anything else is a definitive answer.
 */
const isRetryable = (error: unknown) => {
  if (isResponseError(error)) {
    return error.status >= 500;
  }

  return error instanceof TypeError;
};

/**
 * Whether a file starts with the signature of a PNG, JPEG or WebP, the
 * formats the server accepts.
 *
 * The file's MIME type is not enough, since it comes from the extension,
 * while browsers decode whatever format the bytes are in. A GIF renamed to
 * `.png` would otherwise only be rejected once the envelope is saved.
 */
const hasSupportedImageSignature = async (file: Blob) => {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  const hasBytesAt = (offset: number, bytes: number[]) => bytes.every((byte, index) => header[offset + index] === byte);

  const isPng = hasBytesAt(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isJpeg = hasBytesAt(0, [0xff, 0xd8, 0xff]);

  // "RIFF", then the file size, then "WEBP".
  const isWebp = hasBytesAt(0, [0x52, 0x49, 0x46, 0x46]) && hasBytesAt(8, [0x57, 0x45, 0x42, 0x50]);

  return isPng || isJpeg || isWebp;
};
