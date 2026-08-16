import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { z } from 'zod';

import { ZCscErrorResponseSchema } from './types';

const LEADING_SLASHES_REGEX = /^\/+/;
const TRAILING_SLASHES_REGEX = /\/+$/;

/**
 * Low-level fetch wrapper for the JSON-bodied CSC API methods (§7.1 mandates
 * `Content-Type: application/json` for all API requests).
 *
 * OAuth 2.0 endpoints (`oauth2/token`, `oauth2/revoke`) use
 * `application/x-www-form-urlencoded` per RFC 6749 and are handled by the
 * `arctic` library — see `oauth.ts` in this directory.
 *
 * Normalises CSC error responses (§10.1: `{ error, error_description }`)
 * into {@link AppError}s carrying the upstream HTTP status in
 * {@link AppError.statusCode}, so callers can discriminate without
 * re-parsing the body.
 */

type JoinUrlInput = {
  baseUrl: string;
  path: string;
};

/**
 * Join a CSC base URL with a path segment. Strips trailing/leading slashes so
 * `joinCscUrl({ baseUrl: 'https://x/csc/v1/', path: '/credentials/list' })`
 * yields `https://x/csc/v1/credentials/list`.
 */
export const joinCscUrl = ({ baseUrl, path }: JoinUrlInput): string => {
  const cleanBaseUrl = baseUrl.replace(TRAILING_SLASHES_REGEX, ''); // Strip trailing slashes from base URL.
  const cleanPath = path.replace(LEADING_SLASHES_REGEX, ''); // Strip leading slashes from path.

  const url = new URL(cleanPath, `${cleanBaseUrl}/`);

  return url.toString();
};

type CscRequestErrorOptions = {
  url: string;
  status: number;
  cscError?: { error: string; error_description?: string };
  cause?: unknown;
  errorCode?: string;
};

const buildCscRequestError = ({
  url,
  status,
  cscError,
  cause,
  errorCode = AppErrorCode.CSC_REQUEST_FAILED,
}: CscRequestErrorOptions): AppError => {
  const causeMessage = cause instanceof Error ? cause.message : undefined;

  const parts: string[] = [`CSC request to ${url} failed (HTTP ${status})`];

  if (cscError) {
    parts.push(cscError.error_description ? `${cscError.error}: ${cscError.error_description}` : cscError.error);
  }

  if (causeMessage) {
    parts.push(causeMessage);
  }

  return new AppError(errorCode, {
    message: parts.join(' — '),
    statusCode: status,
  });
};

/**
 * Best-effort parse of a CSC error body. Returns `undefined` on non-JSON or
 * schema mismatch so the caller still surfaces the HTTP status without
 * masking it.
 */
const readCscErrorBody = async (
  response: Response,
): Promise<{ error: string; error_description?: string } | undefined> => {
  try {
    const json = await response.json();
    const parsed = ZCscErrorResponseSchema.safeParse(json);

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

type CscJsonPostOptions = {
  /** Fully-qualified endpoint URL (use {@link joinCscUrl} to build it). */
  url: string;
  /** Decoded JSON body; serialised via `JSON.stringify`. */
  body: Record<string, unknown>;
  /** Bearer access token. Omit for unauthenticated calls (e.g. `info`). */
  accessToken?: string;
  /** Override the AppError code thrown on failure. Defaults to `CSC_REQUEST_FAILED`. */
  errorCode?: string;
  /**
   * Optional `AbortSignal` so callers can enforce their own deadlines
   * (e.g. the 15s sign-time sync timeout).
   */
  signal?: AbortSignal;
};

/**
 * POST a JSON body to a CSC API endpoint and parse the response against the
 * supplied Zod schema.
 *
 * Throws {@link AppError} on:
 * - network/transport error (fetch threw)
 * - non-2xx HTTP response (with CSC error body folded into the message)
 * - malformed JSON response
 * - schema validation failure
 */
export const cscJsonPost = async <T>(opts: CscJsonPostOptions, responseSchema: z.ZodSchema<T>): Promise<T> => {
  const { url, body, accessToken, errorCode, signal } = opts;

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    throw buildCscRequestError({ url, status: 0, cause, errorCode });
  }

  if (!response.ok) {
    const cscError = await readCscErrorBody(response);

    throw buildCscRequestError({
      url,
      status: response.status,
      cscError,
      errorCode,
    });
  }

  let json: unknown;

  try {
    json = await response.json();
  } catch (cause) {
    throw buildCscRequestError({ url, status: response.status, cause, errorCode });
  }

  const parsed = responseSchema.safeParse(json);

  if (!parsed.success) {
    throw buildCscRequestError({
      url,
      status: response.status,
      cause: parsed.error,
      errorCode,
    });
  }

  return parsed.data;
};
