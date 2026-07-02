import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
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
 * Read + validate the blocking-error cookie. Returns `null` when absent or
 * signature-invalid; throws `INVALID_REQUEST` when signed-but-malformed
 * (tamper-shaped, mirroring `oauth-flow-cookie.ts`).
 */
export const getCscBlockingErrorCookie = async (c: Context): Promise<TCscBlockingErrorPayload | null> => {
  const raw = await getSignedCookie(c, getCscCookieSecret(), CSC_BLOCKING_ERROR_COOKIE_NAME);

  if (!raw) {
    return null;
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'CSC blocking error cookie payload is not valid JSON.',
    });
  }

  const result = ZCscBlockingErrorPayloadSchema.safeParse(parsedJson);

  if (!result.success) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'CSC blocking error cookie payload failed schema validation.',
    });
  }

  return result.data;
};

export const clearCscBlockingErrorCookie = (c: Context): void => {
  deleteCookie(c, CSC_BLOCKING_ERROR_COOKIE_NAME, cscCookieBaseOptions);
};

/**
 * Remix-compatible reader: parses + HMAC-verifies the blocking-error cookie
 * from a raw `Cookie` header on a standard `Request`. Returns `null` when
 * absent, signature-invalid, or payload-malformed (no throw — the loader
 * only uses the cookie advisorily, so a bad cookie shouldn't break the page).
 */
export const readCscBlockingErrorFromRequest = async (request: Request): Promise<TCscBlockingErrorPayload | null> => {
  const cookieHeader = request.headers.get('cookie');

  if (!cookieHeader) {
    return null;
  }

  const parsed = await parseSigned(cookieHeader, getCscCookieSecret(), CSC_BLOCKING_ERROR_COOKIE_NAME);

  const value = parsed[CSC_BLOCKING_ERROR_COOKIE_NAME];

  if (typeof value !== 'string') {
    return null;
  }

  try {
    const json = JSON.parse(value);

    const result = ZCscBlockingErrorPayloadSchema.safeParse(json);

    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

/**
 * Serialised `Set-Cookie` header value that expires the cookie immediately.
 * Use in a Remix loader's response headers to clear the cookie after the
 * loader reads it once.
 */
export const buildClearCscBlockingErrorCookieHeader = (): string => {
  return serialize(CSC_BLOCKING_ERROR_COOKIE_NAME, '', {
    ...cscCookieBaseOptions,
    maxAge: 0,
  });
};
