import type { Context } from 'hono';
import { getSignedCookie, setSignedCookie } from 'hono/cookie';
import { parseSigned, serialize } from 'hono/utils/cookie';
import { z } from 'zod';

import { CSC_BLOCKING_ERROR_COOKIE_NAME, cscCookieBaseOptions, getCscCookieSecret } from './shared';

/**
 * `csc_blocking_error` — one-shot surface for service-scope OAuth callback
 * failures the recipient can't self-resolve (empty credential list, invalid
 * cert, refused algorithm, etc.). The `/sign/{token}` loader reads + clears
 * it on next visit so no error state rides on URL query params.
 */

const CSC_BLOCKING_ERROR_MAX_AGE_SECONDS = 60 * 10; // 10 minutes — matches the other short-lived CSC cookies.

export const ZCscBlockingErrorPayloadSchema = z.object({
  /** `AppErrorCode` value, e.g. `'CSC_CREDENTIAL_LIST_EMPTY'`. */
  code: z.string().min(1),
  /** Recipient token from `/sign/{token}`; loader scopes the error to its recipient. */
  recipientToken: z.string().min(1),
});

export type TCscBlockingErrorPayload = z.infer<typeof ZCscBlockingErrorPayloadSchema>;

type SetCscBlockingErrorCookieOptions = {
  c: Context;
  payload: TCscBlockingErrorPayload;
};

export const setCscBlockingErrorCookie = async (options: SetCscBlockingErrorCookieOptions): Promise<void> => {
  const { c, payload } = options;

  await setSignedCookie(c, CSC_BLOCKING_ERROR_COOKIE_NAME, JSON.stringify(payload), getCscCookieSecret(), {
    ...cscCookieBaseOptions,
    maxAge: CSC_BLOCKING_ERROR_MAX_AGE_SECONDS,
  });
};

/**
 * The cookie is advisory (it only decides which error banner to show), so a
 * malformed payload is treated the same as a missing one rather than failing
 * the request.
 */
const parseCscBlockingErrorPayload = (raw: string | undefined | false): TCscBlockingErrorPayload | null => {
  if (typeof raw !== 'string') {
    return null;
  }

  try {
    const result = ZCscBlockingErrorPayloadSchema.safeParse(JSON.parse(raw));

    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

/**
 * Hono reader. Returns `null` when the cookie is absent, signature-invalid or
 * payload-malformed.
 */
export const getCscBlockingErrorCookie = async (c: Context): Promise<TCscBlockingErrorPayload | null> => {
  const raw = await getSignedCookie(c, getCscCookieSecret(), CSC_BLOCKING_ERROR_COOKIE_NAME);

  return parseCscBlockingErrorPayload(raw);
};

/**
 * Remix-compatible reader: parses + HMAC-verifies the blocking-error cookie
 * from the raw `Cookie` header on a standard `Request`. Same `null` semantics
 * as `getCscBlockingErrorCookie`.
 */
export const readCscBlockingErrorFromRequest = async (request: Request): Promise<TCscBlockingErrorPayload | null> => {
  const cookieHeader = request.headers.get('cookie');

  if (!cookieHeader) {
    return null;
  }

  const parsed = await parseSigned(cookieHeader, getCscCookieSecret(), CSC_BLOCKING_ERROR_COOKIE_NAME);

  return parseCscBlockingErrorPayload(parsed[CSC_BLOCKING_ERROR_COOKIE_NAME]);
};

/**
 * `Set-Cookie` header value that expires the cookie immediately. Remix loaders
 * attach it to the response after reading the cookie once, since they have no
 * Hono context to call `deleteCookie` on.
 */
export const expiredCscBlockingErrorCookieHeader = (): string => {
  return serialize(CSC_BLOCKING_ERROR_COOKIE_NAME, '', {
    ...cscCookieBaseOptions,
    maxAge: 0,
  });
};
