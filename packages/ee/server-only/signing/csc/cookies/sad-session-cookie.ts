import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { parseSigned } from 'hono/utils/cookie';

import { CSC_SAD_SESSION_COOKIE_NAME, cscCookieBaseOptions, getCscCookieSecret } from './shared';

/**
 * `csc_sad_session` — HMAC-signed `CscSession` cuid. Set after the
 * credential-scope OAuth callback exchanges code → SAD; pointed at the
 * server-side session row that owns the SAD + the prep-time item hashes.
 *
 * Lifetime mirrors the TSP-asserted SAD expiry (`sadExpiresAt`) so the cookie
 * cannot outlive its server-side authorisation. Cleared by the sync sign
 * mutation on success; otherwise decays naturally with the browser TTL.
 */

type SetCscSadSessionCookieOptions = {
  c: Context;
  sessionId: string;
  /** Mirror of `CscSession.sadExpiresAt`; cookie expires no later than the SAD. */
  expiresAt: Date;
};

export const setCscSadSessionCookie = async (options: SetCscSadSessionCookieOptions): Promise<void> => {
  const { c, sessionId, expiresAt } = options;

  await setSignedCookie(c, CSC_SAD_SESSION_COOKIE_NAME, sessionId, getCscCookieSecret(), {
    ...cscCookieBaseOptions,
    expires: expiresAt,
  });
};

export const getCscSadSessionCookie = async (c: Context): Promise<string | null> => {
  const value = await getSignedCookie(c, getCscCookieSecret(), CSC_SAD_SESSION_COOKIE_NAME);

  // `getSignedCookie` returns `false` on signature mismatch, `undefined` when
  // the cookie is absent. Both collapse to `null` for the caller's sake.
  return value ? value : null;
};

export const clearCscSadSessionCookie = (c: Context): void => {
  deleteCookie(c, CSC_SAD_SESSION_COOKIE_NAME, cscCookieBaseOptions);
};

/**
 * Remix-compatible reader: parses + HMAC-verifies the SAD-session cookie
 * from a raw `Cookie` header on a standard `Request`. Mirrors
 * `getCscSadSessionCookie` but works outside Hono's `Context`.
 */
export const readCscSadSessionFromRequest = async (request: Request): Promise<string | null> => {
  const cookieHeader = request.headers.get('cookie');

  if (!cookieHeader) {
    return null;
  }

  const parsed = await parseSigned(cookieHeader, getCscCookieSecret(), CSC_SAD_SESSION_COOKIE_NAME);
  const value = parsed[CSC_SAD_SESSION_COOKIE_NAME];

  return typeof value === 'string' ? value : null;
};
