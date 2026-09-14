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
   * The file name, when the response exposed it. Cross origin responses do
   * not expose the header it rides on unless explicitly allowed.
   */
  fileName: string | null;

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
 * Read the file name from a `Content-Disposition` header, preferring the
 * RFC 5987 encoded form (`filename*=UTF-8''...`) over the plain quoted one.
 */
export const parseContentDispositionFileName = (header: string | null): string | null => {
  if (!header) {
    return null;
  }

  const encodedMatch = header.match(/filename\*=(?:UTF-8|utf-8)''([^;]+)/);

  if (encodedMatch) {
    try {
      return decodeURIComponent(encodedMatch[1].trim());
    } catch {
      // Fall through to the plain file name.
    }
  }

  const plainMatch = header.match(/filename="([^"]*)"/) ?? header.match(/filename=([^;]+)/);

  return plainMatch ? plainMatch[1].trim() : null;
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
      fileName: parseContentDispositionFileName(response.headers.get('Content-Disposition')),
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
