import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';

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

  // Basic paths to ignore.
  if (path.startsWith('/api') || path.endsWith('.data') || path.startsWith('/__manifest')) {
    return next();
  }

  debug.log('Path', path);

  const preferredTeamUrl = getCookie(c, 'preferred-team-url');

  const referrer = c.req.header('referer');
  const referrerUrl = referrer ? new URL(referrer) : null;
  const referrerPathname = referrerUrl ? referrerUrl.pathname : null;

  // // Whether to reset the preferred team url cookie if the user accesses a non team page from a team page.
  // const resetPreferredTeamUrl =
  //   referrerPathname &&
  //   referrerPathname.startsWith('/t/') &&
  //   (!path.startsWith('/t/') || path === '/');

  // // Redirect root page to `/documents` or `/t/{preferredTeamUrl}/documents`.
  // if (path === '/') {
  //   debug.log('Redirecting from root to documents');

  //   const redirectUrlPath = formatDocumentsPath(
  //     resetPreferredTeamUrl ? undefined : preferredTeamUrl,
  //   );

  //   const redirectUrl = new URL(redirectUrlPath, req.url);

  //   return c.redirect(redirectUrl);
  // }

  // // Set the preferred team url cookie if user accesses a team page.
  // if (path.startsWith('/t/')) {
  //   setCookie(c, 'preferred-team-url', path.split('/')[2]);
  //   return next();
  // }

  // // Clear preferred team url cookie if user accesses a non team page from a team page.
  // if (resetPreferredTeamUrl || path === '/documents') {
  //   debug.log('Resetting preferred team url');

  //   deleteCookie(c, 'preferred-team-url');
  //   return next();
  // }
};
