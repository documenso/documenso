import type { Context, Next } from 'hono';

import { extractSessionCookieFromHeaders } from '@documenso/auth/server/lib/session/session-cookies';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import type { AppSession } from '@documenso/lib/client-only/providers/session';
import { type TGetTeamByUrlResponse, getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { type TGetTeamsResponse, getTeams } from '@documenso/lib/server-only/team/get-teams';
import {
  type RequestMetadata,
  extractRequestMetadata,
} from '@documenso/lib/universal/extract-request-metadata';
import { AppDebugger } from '@documenso/lib/utils/debugger';

const debug = new AppDebugger('Middleware');

export type AppContext = {
  requestMetadata: RequestMetadata;
  session: AppSession | null;
};

export const appContext = async (c: Context, next: Next) => {
  const initTime = Date.now();

  const request = c.req.raw;
  const url = new URL(request.url);

  const noSessionCookie = extractSessionCookieFromHeaders(request.headers) === null;

  if (!isPageRequest(request) || noSessionCookie || blacklistedPathsRegex.test(url.pathname)) {
    // debug.log('Pathname ignored', url.pathname);

    setAppContext(c, {
      requestMetadata: extractRequestMetadata(request),
      session: null,
    });

    return next();
  }

  const splitUrl = url.pathname.replace('.data', '').split('/');

  let team: TGetTeamByUrlResponse | null = null;
  let teams: TGetTeamsResponse = [];

  const session = await getOptionalSession(c);

  if (session.isAuthenticated) {
    let teamUrl = null;

    if (splitUrl[1] === 't' && splitUrl[2]) {
      teamUrl = splitUrl[2];
    }

    const result = await Promise.all([
      getTeams({ userId: session.user.id }),
      teamUrl ? getTeamByUrl({ userId: session.user.id, teamUrl }).catch(() => null) : null,
    ]);

    teams = result[0];
    team = result[1];
  }

  const endTime = Date.now();
  debug.log(`Pathname accepted in ${endTime - initTime}ms`, url.pathname);

  setAppContext(c, {
    requestMetadata: extractRequestMetadata(request),
    session: session.isAuthenticated
      ? {
          session: session.session,
          user: session.user,
          currentTeam: team,
          teams,
        }
      : null,
  });

  return next();
};

const setAppContext = (c: Context, context: AppContext) => {
  c.set('context', context);
};

const isPageRequest = (request: Request) => {
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return false;
  }

  // If it ends with .data it's the loader which we need to pass context for.
  if (url.pathname.endsWith('.data')) {
    return true;
  }

  if (request.headers.get('Accept')?.includes('text/html')) {
    return true;
  }

  return false;
};

/**
 * List of paths to reject
 * - Urls that start with /api
 * - Urls that start with _
 */
const blacklistedPathsRegex = new RegExp('^/api/|^/__');
