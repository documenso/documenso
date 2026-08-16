import { env } from '@documenso/lib/utils/env';

export const DOCUMENT_CONVERSION_MIME_TYPE_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const DEFAULT_DOCUMENT_CONVERSION_TIMEOUT_MS = 30_000;

/**
 * Returns whether the document conversion feature is enabled.
 *
 * Platform-aware:
 * - On the server, checks the private URL is configured.
 * - On the client, reads the derived public flag injected via `window.__ENV__`.
 */
export const IS_DOCUMENT_CONVERSION_ENABLED = (): boolean => {
  if (typeof window === 'undefined') {
    return !!env('NEXT_PRIVATE_DOCUMENT_CONVERSION_URL');
  }

  return env('NEXT_PUBLIC_DOCUMENT_CONVERSION_ENABLED') === 'true';
};

/**
 * Returns the configured conversion service base URL as supplied via env, or
 * `undefined` if not configured.
 *
 * Server-side only.
 */
export const DOCUMENT_CONVERSION_URL = (): string | undefined => {
  return env('NEXT_PRIVATE_DOCUMENT_CONVERSION_URL');
};

/**
 * Returns HTTP Basic auth credentials for the conversion service, or
 * `undefined` if either env var is missing. When Gotenberg is started with
 * `--api-enable-basic-auth`, every request must carry these credentials.
 *
 * Server-side only.
 */
export const DOCUMENT_CONVERSION_AUTH = (): { username: string; password: string } | undefined => {
  const username = env('NEXT_PRIVATE_DOCUMENT_CONVERSION_USERNAME');
  const password = env('NEXT_PRIVATE_DOCUMENT_CONVERSION_PASSWORD');

  if (!username || !password) {
    return undefined;
  }

  return { username, password };
};

/**
 * Returns the per-request timeout for conversion calls in milliseconds.
 *
 * Falls back to a 30 second default when the env value is missing or
 * unparseable.
 */
export const DOCUMENT_CONVERSION_TIMEOUT_MS = (): number => {
  const raw = env('NEXT_PRIVATE_DOCUMENT_CONVERSION_TIMEOUT_MS');

  if (!raw) {
    return DEFAULT_DOCUMENT_CONVERSION_TIMEOUT_MS;
  }

  const parsed = parseInt(raw, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_DOCUMENT_CONVERSION_TIMEOUT_MS;
  }

  return parsed;
};

/**
 * Returns the mime type -> extensions map that should be passed to the
 * dropzone `accept` config and used for server-side validation.
 *
 * Always includes PDF; only includes DOCX when the conversion feature is
 * enabled.
 */
export const getAllowedUploadMimeTypes = (): Record<string, string[]> => {
  const base: Record<string, string[]> = {
    'application/pdf': ['.pdf'],
  };

  if (IS_DOCUMENT_CONVERSION_ENABLED()) {
    base[DOCUMENT_CONVERSION_MIME_TYPE_DOCX] = ['.docx'];
  }

  return base;
};
