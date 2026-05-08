import { createSession, generateSessionToken } from '@documenso/auth/server/lib/session/session.js';
import { setSessionCookie } from '@documenso/auth/server/lib/session/session-cookies';
import { AppError } from '@documenso/lib/errors/app-error';
import { getApiTokenByToken } from '@documenso/lib/server-only/public-api/get-api-token-by-token';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { Hono } from 'hono';

import type { HonoEnv } from '../../router';

export const tokenLoginRoute = new Hono<HonoEnv>();

/**
 * GET /auth/token-login?token=<api_token>&redirect=<path>
 *
 * Exchanges an API token for a browser session (cookie) and redirects.
 * Used by fixOS to open Documenso with SSO-like seamless login.
 */
tokenLoginRoute.get('/token-login', async (c) => {
  const token = c.req.query('token');
  const redirect = c.req.query('redirect') || '/';

  if (!token) {
    return c.text('Missing token parameter', 400);
  }

  // Prevent open redirect: only allow relative paths.
  if (
    redirect.startsWith('//') ||
    redirect.startsWith('http:') ||
    redirect.startsWith('https:') ||
    !redirect.startsWith('/')
  ) {
    return c.text('Invalid redirect parameter', 400);
  }

  try {
    const apiToken = await getApiTokenByToken({ token });

    if (!apiToken.user) {
      return c.text('Token has no associated user', 401);
    }

    if (apiToken.user.disabled) {
      return c.text('User account is disabled', 403);
    }

    const sessionToken = generateSessionToken();
    const metadata = extractRequestMetadata(c.req.raw);

    await createSession(sessionToken, apiToken.user.id, metadata);
    await setSessionCookie(c, sessionToken);

    return c.redirect(redirect);
  } catch (err) {
    if (err instanceof AppError) {
      return c.text('Invalid or expired token', 401);
    }

    throw err;
  }
});
