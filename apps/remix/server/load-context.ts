import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { type TGetTeamByUrlResponse, getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { type TGetTeamsResponse, getTeams } from '@documenso/lib/server-only/team/get-teams';

type GetLoadContextArgs = {
  request: Request;
};

declare module 'react-router' {
  interface AppLoadContext extends Awaited<ReturnType<typeof getLoadContext>> {}
}

export async function getLoadContext(args: GetLoadContextArgs) {
  const initTime = Date.now();

  const request = args.request;
  const url = new URL(request.url);

  // Todo only make available for get requests (loaders) and non api routes
  // use config
  if (request.method !== 'GET' || !config.matcher.test(url.pathname)) {
    console.log('[Session]: Pathname ignored', url.pathname);
    return {
      session: null,
    };
  }

  const splitUrl = url.pathname.split('/');

  let team: TGetTeamByUrlResponse | null = null;

  const session = await getSession(args.request);

  if (session.isAuthenticated && splitUrl[1] === 't' && splitUrl[2]) {
    const teamUrl = splitUrl[2];

    team = await getTeamByUrl({ userId: session.user.id, teamUrl });
  }

  let teams: TGetTeamsResponse = [];

  if (session.isAuthenticated) {
    // This is always loaded for the header.
    teams = await getTeams({ userId: session.user.id });
  }

  const endTime = Date.now();
  console.log(`[Session]: Pathname accepted in ${endTime - initTime}ms`, url.pathname);

  // Todo: Optimise and chain promises.
  // Todo: This is server only right?? Results not exposed?

  return {
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

/**
 * Route matcher configuration that excludes common non-route paths:
 * - /api/* (API routes)
 * - /assets/* (Static assets)
 * - /build/* (Build output)
 * - /favicon.* (Favicon files)
 * - *.webmanifest (Web manifest files)
 * - Paths starting with . (e.g. .well-known)
 *
 * The regex pattern (?!pattern) is a negative lookahead that ensures the path does NOT match any of these patterns.
 * The .* at the end matches any remaining characters in the path.
 */
const config = {
  matcher: new RegExp(
    '/((?!api|assets|static|build|favicon|__manifest|site.webmanifest|manifest.webmanifest|\\..*).*)',
  ),
};
