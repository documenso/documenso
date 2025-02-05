import { extractSessionCookieFromHeaders } from '@documenso/auth/server/lib/session/session-cookies';
import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { type TGetTeamByUrlResponse, getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { type TGetTeamsResponse, getTeams } from '@documenso/lib/server-only/team/get-teams';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { AppLogger } from '@documenso/lib/utils/debugger';

type GetLoadContextArgs = {
  request: Request;
};

declare module 'react-router' {
  interface AppLoadContext extends Awaited<ReturnType<typeof getLoadContext>> {}
}

const logger = new AppLogger('[Context]');

export async function getLoadContext(args: GetLoadContextArgs) {
  const initTime = Date.now();

  const request = args.request;
  const url = new URL(request.url);

  const noSessionCookie = extractSessionCookieFromHeaders(request.headers) === null;

  if (!isPageRequest(request) || noSessionCookie) {
    logger.log('Pathname ignored', url.pathname);

    return {
      requestMetadata: extractRequestMetadata(request),
      session: null,
    };
  }

  const splitUrl = url.pathname.split('/');

  let team: TGetTeamByUrlResponse | null = null;
  let teams: TGetTeamsResponse = [];

  const session = await getSession(args.request);

  if (session.isAuthenticated) {
    let teamUrl = null;

    if (splitUrl[1] === 't' && splitUrl[2]) {
      teamUrl = splitUrl[2];
    }

    const result = await Promise.all([
      getTeams({ userId: session.user.id }),
      teamUrl ? getTeamByUrl({ userId: session.user.id, teamUrl }) : null,
    ]);

    teams = result[0];
    team = result[1];
  }

  const endTime = Date.now();
  logger.log(`Pathname accepted in ${endTime - initTime}ms`, url.pathname);

  return {
    requestMetadata: extractRequestMetadata(request),
    session: session.isAuthenticated
      ? {
          session: session.session,
          user: session.user,
          currentTeam: team,
          teams,
        }
      : null,
  };
}

const isPageRequest = (request: Request) => {
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return false;
  }

  if (url.pathname.endsWith('.data')) {
    return true;
  }

  if (request.headers.get('Accept')?.includes('text/html')) {
    return true;
  }

  return false;
};
