import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';

import { setCsrfCookie } from '@documenso/auth/server/lib/session/session-cookies';
import { AppLogger } from '@documenso/lib/utils/debugger';

const logger = new AppLogger('Middleware');

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

  logger.log('Path', path);

  const preferredTeamUrl = getCookie(c, 'preferred-team-url');

  const referrer = c.req.header('referer');
  const referrerUrl = referrer ? new URL(referrer) : null;
  const referrerPathname = referrerUrl ? referrerUrl.pathname : null;

  // Set csrf token if not set.
  const csrfToken = getCookie(c, 'csrfToken');

  // Todo: Currently not working.
  if (!csrfToken) {
    await setCsrfCookie(c);
  }

  // // Whether to reset the preferred team url cookie if the user accesses a non team page from a team page.
  // const resetPreferredTeamUrl =
  //   referrerPathname &&
  //   referrerPathname.startsWith('/t/') &&
  //   (!path.startsWith('/t/') || path === '/');

  // // Redirect root page to `/documents` or `/t/{preferredTeamUrl}/documents`.
  // if (path === '/') {
  //   logger.log('Redirecting from root to documents');

  //   const redirectUrlPath = formatDocumentsPath(
  //     resetPreferredTeamUrl ? undefined : preferredTeamUrl,
  //   );

  //   const redirectUrl = new URL(redirectUrlPath, req.url);

  //   return c.redirect(redirectUrl);
  // }

  // // Redirect `/t` to `/settings/teams`.
  // if (path === '/t' || path === '/t/') {
  //   logger.log('Redirecting to /settings/teams');

  //   const redirectUrl = new URL('/settings/teams', req.url);
  //   return c.redirect(redirectUrl);
  // }

  // // Redirect `/t/<team_url>` to `/t/<team_url>/documents`.
  // if (TEAM_URL_ROOT_REGEX.test(path)) {
  //   logger.log('Redirecting team documents');

  //   const redirectUrl = new URL(`${path}/documents`, req.url);
  //   setCookie(c, 'preferred-team-url', path.replace('/t/', ''));

  //   return c.redirect(redirectUrl);
  // }

  // // Set the preferred team url cookie if user accesses a team page.
  // if (path.startsWith('/t/')) {
  //   setCookie(c, 'preferred-team-url', path.split('/')[2]);
  //   return next();
  // }

  // // Clear preferred team url cookie if user accesses a non team page from a team page.
  // if (resetPreferredTeamUrl || path === '/documents') {
  //   logger.log('Resetting preferred team url');

  //   deleteCookie(c, 'preferred-team-url');
  //   return next();
  // }

  return next();
};
