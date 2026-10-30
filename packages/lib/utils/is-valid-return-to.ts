import { getBasePath, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { z } from 'zod';

/**
 * The origin of the web app, ignoring any sub-path NEXT_PUBLIC_WEBAPP_URL carries.
 */
const getWebAppOrigin = () => {
  try {
    return new URL(NEXT_PUBLIC_WEBAPP_URL()).origin;
  } catch {
    return NEXT_PUBLIC_WEBAPP_URL();
  }
};

/**
 * Decode and parse a `returnTo` value against the web app URL, returning it
 * only when it stays on the web app's origin.
 *
 * Compares against the origin, not the raw env value: when the app is served
 * under a sub-path NEXT_PUBLIC_WEBAPP_URL is e.g. "https://host/ESign", which
 * never equals a URL's origin ("https://host").
 */
const parseSameOriginUrl = (returnTo?: string) => {
  if (!returnTo) {
    return undefined;
  }

  try {
    const url = new URL(decodeURIComponent(returnTo), NEXT_PUBLIC_WEBAPP_URL());

    return url.origin === getWebAppOrigin() ? url : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Strip the sub-path ("/ESign/inbox" -> "/inbox") so the result matches what
 * React Router's `<Link>`, `navigate()` and `redirect()` expect, since they
 * prepend the basename themselves.
 */
const stripBasePath = (pathname: string) => {
  const basePath = getBasePath();

  if (basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
    return pathname.slice(basePath.length) || '/';
  }

  return pathname;
};

const isApiRoute = (pathname: string) => pathname === '/api' || pathname.startsWith('/api/');

export type GetValidReturnToOptions = {
  /**
   * Accept destinations under `/api/`. Only the post sign-in redirect needs
   * this (`SignInForm` and the OAuth callback): the embed flow completes
   * through an API route that then redirects onwards.
   */
  allowApiRoutes?: boolean;
};

/**
 * Validate a `returnTo` destination and return it as an app-relative path
 * (`/inbox`, never `/ESign/inbox`), or `undefined` when it must be ignored.
 *
 * - Only same-origin destinations are accepted. The result is decoded and
 *   checked once more, because the browser and the server will decode it again
 *   when it is used. This catches values that only turn into an external URL
 *   or an API route after that second decode (`/%2F%2Fevil`, `/%2561pi/...`).
 * - API routes are rejected unless `allowApiRoutes` is set: a destination is a
 *   top-level navigation, and nothing legitimate lands a browser on `/api/*`.
 *
 * The result can be handed directly to React Router's `<Link>`, `navigate()`
 * and `redirect()`. When sending it to the browser verbatim instead
 * (`window.location`, a Hono `c.redirect`), wrap it in `formatPath()` to
 * re-apply the sub-path.
 */
export const getValidReturnTo = (returnTo?: string, options: GetValidReturnToOptions = {}) => {
  const url = parseSameOriginUrl(returnTo);

  if (!url) {
    return undefined;
  }

  const appRelativeReturnTo = `${stripBasePath(url.pathname)}${url.search}${url.hash}`;

  const decodedUrl = parseSameOriginUrl(appRelativeReturnTo);

  if (!decodedUrl) {
    return undefined;
  }

  if (!options.allowApiRoutes && isApiRoute(decodedUrl.pathname)) {
    return undefined;
  }

  return appRelativeReturnTo;
};

/**
 * Read and validate the `returnTo` query parameter of a request, for use in
 * route loaders.
 */
export const getReturnToFromRequest = (request: Request, options?: GetValidReturnToOptions) => {
  const returnTo = new URL(request.url).searchParams.get('returnTo') ?? undefined;

  return getValidReturnTo(returnTo, options);
};

/**
 * Request schema for an optional `returnTo` field. Invalid destinations are
 * dropped rather than rejected so a bad link never blocks the action itself.
 */
export const ZReturnToSchema = z
  .string()
  .optional()
  .transform((returnTo) => getValidReturnTo(returnTo));

/**
 * Append `returnTo` to a root-relative path as a query parameter when present.
 *
 * `withReturnTo('/signin', '/inbox')` -> `/signin?returnTo=%2Finbox`
 * `withReturnTo('/signin')` -> `/signin`
 */
export const withReturnTo = (path: string, returnTo?: string) => {
  if (!returnTo) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';

  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
};
