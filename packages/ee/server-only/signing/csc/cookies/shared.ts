import {
  embedAuthFlowCookieOptions,
  embedSessionCookieOptions,
} from '@documenso/auth/server/lib/session/session-cookies';
import { formatHostCookieName } from '@documenso/lib/constants/auth';
import { requireEnv } from '@documenso/lib/utils/env';

/**
 * Shared HMAC secret + base attribute set for the CSC cookies.
 *
 * `NEXTAUTH_SECRET` is reused so signed-cookie verification stays uniform
 * across the auth + CSC surfaces.
 */

/** HMAC secret for hono `setSignedCookie` / `getSignedCookie`. */
export const getCscCookieSecret = (): string => requireEnv('NEXTAUTH_SECRET');

/**
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
export const CSC_SERVICE_SESSION_COOKIE_NAME = formatHostCookieName('csc_service_session');
export const CSC_SAD_SESSION_COOKIE_NAME = formatHostCookieName('csc_sad_session');
export const CSC_OAUTH_FLOW_COOKIE_NAME = formatHostCookieName('csc_oauth_flow');
export const CSC_BLOCKING_ERROR_COOKIE_NAME = formatHostCookieName('csc_blocking_error');

/**
 * Partitioned so the CSC cookies can be read from inside a cross-site embed
 * iframe. Partitioning is harmless top-level (the key is our own site) and
 * ignored by browsers that predate it. Callers add their own expiry.
 */
export const cscCookieBaseOptions = embedSessionCookieOptions;

// The TSP redirect back is always top-level, so `SameSite=Lax` suffices here.
// `maxAge` is owned by `oauth-flow-cookie.ts`.
export const cscOAuthFlowCookieOptions = {
  ...embedAuthFlowCookieOptions,
  maxAge: undefined,
} as const;
