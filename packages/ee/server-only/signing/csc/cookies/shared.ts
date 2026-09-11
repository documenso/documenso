import { formatSecureCookieName, getCookieDomain, useSecureCookies } from '@documenso/lib/constants/auth';
import { requireEnv } from '@documenso/lib/utils/env';

/**
 * Shared HMAC secret + base attribute set for the CSC cookies.
 *
 * `NEXTAUTH_SECRET` is reused so signed-cookie verification stays uniform
 * across the auth + CSC surfaces. The `sameSite` conditional matches
 * `sessionCookieOptions` in `@documenso/auth` so a future embedding flow
 * (CSC inside an `<iframe>` on a partner host) works without a separate
 * cookie-attribute regime.
 */

/** HMAC secret for hono `setSignedCookie` / `getSignedCookie`. */
export const getCscCookieSecret = (): string => requireEnv('NEXTAUTH_SECRET');

/**
 * CSC cookie names; prefixed with `__Secure-` in production over HTTPS.
 *
 * Naming maps 1:1 to the CSC OAuth scope each cookie attests:
 * - `csc_service_session` — service-scope grant (long-lived per-browser SCA
 *   attestation; lifetime = TSP `expires_in`).
 * - `csc_sad_session` — credential-scope grant in progress (in-flight signing
 *   transaction; lifetime = SAD lifetime).
 * - `csc_oauth_flow` — single-round-trip carrier across authorize → callback
 *   (scope-agnostic; both flows reuse it).
 * - `csc_blocking_error` — callback failure surface; carries an unresolvable
 *   service-scope error (e.g. empty credential list, refused algorithm) to
 *   the next `/sign/{token}` loader, read-once.
 */
export const CSC_SERVICE_SESSION_COOKIE_NAME = formatSecureCookieName('csc_service_session');
export const CSC_SAD_SESSION_COOKIE_NAME = formatSecureCookieName('csc_sad_session');
export const CSC_OAUTH_FLOW_COOKIE_NAME = formatSecureCookieName('csc_oauth_flow');
export const CSC_BLOCKING_ERROR_COOKIE_NAME = formatSecureCookieName('csc_blocking_error');

/**
 * Base options spread into every CSC cookie. Callers add per-cookie expiry
 * (`maxAge` or `expires`) on top.
 */
export const cscCookieBaseOptions = {
  httpOnly: true,
  path: '/',
  sameSite: useSecureCookies ? 'none' : 'lax',
  secure: useSecureCookies,
  domain: getCookieDomain(),
} as const;
