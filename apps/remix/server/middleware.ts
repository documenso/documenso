import type { Context, Next } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';

import { AppDebugger } from '@documenso/lib/utils/debugger';

const debug = new AppDebugger('Middleware');

/**
 * Middleware for initial page loads.
 *
 * You won't be able to easily handle sequential page loads because they will be
 * called under `path.data`
 *
 * Example an initial page load would be `/documents` then if the user click templates
 * the path here would be `/templates.data`.
 */
export const appMiddleware = async (c: Context, next: Next) => {
  const { req } = c;
  const { path } = req;

  // Paths to ignore.
  if (nonPagePathRegex.test(path)) {
    return next();
  }

  // PRE-HANDLER CODE: Place code here to execute BEFORE the route handler runs.

  await next();

  // POST-HANDLER CODE: Place code here to execute AFTER the route handler completes.
  // This is useful for:
  // - Setting cookies
  // - Any operations that should happen after all route handlers but before sending the response

  debug.log('Path', path);

  const pathname = path.replace('.data', '');
  const referrer = c.req.header('referer');
  const referrerUrl = referrer ? new URL(referrer) : null;
  const referrerPathname = referrerUrl ? referrerUrl.pathname : null;

  // Whether to reset the preferred team url cookie if the user accesses a non team page from a team page.
  const resetPreferredTeamUrl =
    referrerPathname &&
    referrerPathname.startsWith('/t/') &&
    (!pathname.startsWith('/t/') || pathname === '/');

  // Set the preferred team url cookie if user accesses a team page.
  if (pathname.startsWith('/t/')) {
    debug.log('Setting preferred team url cookie');

    setCookie(c, 'preferred-team-url', pathname.split('/')[2], {
      sameSite: 'lax',
    });

    return;
  }

  // Clear preferred team url cookie if user accesses a non team page from a team page.
  if (resetPreferredTeamUrl || pathname === '/documents') {
    debug.log('Deleting preferred team url cookie');

    deleteCookie(c, 'preferred-team-url');

    return;
  }
};

// This regex matches any path that:
// 1. Starts with /api/, /ingest/, /__manifest/, or /assets/
// 2. Starts with /apple- (like /apple-touch-icon.png)
// 3. Starts with /favicon (like /favicon.ico)
// The ^ ensures matching from the beginning of the string
// The | acts as OR operator between different patterns
const nonPagePathRegex = /^(\/api\/|\/ingest\/|\/__manifest|\/assets\/|\/apple-.*|\/favicon.*)/;
