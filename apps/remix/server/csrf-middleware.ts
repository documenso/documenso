import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createMiddleware } from 'hono/factory';

import type { HonoEnv } from './router';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Origin-based CSRF protection for cookie-authenticated mutations.
 *
 * Needed because the embed session cookie is `SameSite=None; Partitioned`, so
 * any page hosting our embed iframe can send credentialed cross-site form/fetch
 * requests that skip CORS preflight.
 *
 * Bearer/API-token requests are exempt since a browser can't attach
 * `Authorization` cross-site without a preflight we never grant. Browser-managed
 * schemes (e.g. `Basic` via a reverse proxy) deliberately aren't exempt.
 */
export const csrfMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) {
    return await next();
  }

  if (isApiAuthorization(c.req.header('Authorization'))) {
    return await next();
  }

  const origin = c.req.header('Origin');
  const validOrigin = new URL(NEXT_PUBLIC_WEBAPP_URL()).origin;

  if (origin !== validOrigin) {
    c.get('logger').warn({
      event: 'csrf.origin_rejected',
      method: c.req.method,
      path: c.req.path,
      origin: origin ?? null,
    });

    return c.json(
      {
        message: 'Forbidden',
        statusCode: 403,
      },
      403,
    );
  }

  return await next();
});

const isApiAuthorization = (header: string | undefined): boolean => {
  if (!header) {
    return false;
  }

  const value = header.trim().toLowerCase();

  return value.startsWith('bearer ') || value.startsWith('api_');
};
