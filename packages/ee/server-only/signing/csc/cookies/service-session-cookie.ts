import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { parseSigned } from 'hono/utils/cookie';

import { CSC_SERVICE_SESSION_COOKIE_NAME, cscCookieBaseOptions, getCscCookieSecret } from './shared';

/**
 * `csc_service_session` — recipient-scoped attestation that this browser just
 * completed a service-scope OAuth round-trip for `<recipientToken>`. The
 * `/sign/{token}` loader compares the cookie value against the path token; on
 * match it skips re-auth, breaking the redirect loop that would otherwise
 * occur when the TSP silently re-grants from its cached SCA session.
 *
 * Covers the long-lived T1→T3 window (recipient on the signing page filling
 * fields, before clicking Sign). `csc_sad_session` covers the much shorter
 * T4→T5 window (active signing transaction); the two are complementary, not
 * substitutes.
 *
 * TTL = TSP-asserted service-scope `expires_in` so the trust window can never
 * outlive the underlying access token.
 */

type SetCscServiceSessionCookieOptions = {
  c: Context;
  recipientToken: string;
  /** TSP service-scope `expires_in` in seconds. Mirrored as the cookie max-age. */
  ttlSeconds: number;
};

export const setCscServiceSessionCookie = async (options: SetCscServiceSessionCookieOptions): Promise<void> => {
  const { c, recipientToken, ttlSeconds } = options;

  await setSignedCookie(c, CSC_SERVICE_SESSION_COOKIE_NAME, recipientToken, getCscCookieSecret(), {
    ...cscCookieBaseOptions,
    maxAge: ttlSeconds,
  });
};

export const getCscServiceSessionCookie = async (c: Context): Promise<string | null> => {
  const value = await getSignedCookie(c, getCscCookieSecret(), CSC_SERVICE_SESSION_COOKIE_NAME);

  return value ? value : null;
};

export const clearCscServiceSessionCookie = (c: Context): void => {
  deleteCookie(c, CSC_SERVICE_SESSION_COOKIE_NAME, cscCookieBaseOptions);
};

/**
 * Remix-compatible reader: parses + HMAC-verifies the service-session cookie
 * from a raw `Cookie` header on a standard `Request`. Mirrors
 * `getCscServiceSessionCookie` but works outside Hono's `Context`.
 */
export const readCscServiceSessionFromRequest = async (request: Request): Promise<string | null> => {
  const cookieHeader = request.headers.get('cookie');

  if (!cookieHeader) {
    return null;
  }

  const parsed = await parseSigned(cookieHeader, getCscCookieSecret(), CSC_SERVICE_SESSION_COOKIE_NAME);
  const value = parsed[CSC_SERVICE_SESSION_COOKIE_NAME];

  return typeof value === 'string' ? value : null;
};
