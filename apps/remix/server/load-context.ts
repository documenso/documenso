// import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { getSession } from '@documenso/auth/server/lib/utils/get-session';

type GetLoadContextArgs = {
  request: Request;
};

declare module 'react-router' {
  interface AppLoadContext extends Awaited<ReturnType<typeof getLoadContext>> {
    session: any;
    url: string;
    extra: string;
  }
}

export async function getLoadContext(args: GetLoadContextArgs) {
  console.log('-----------------');
  console.log(args.request.url);

  const url = new URL(args.request.url);
  console.log(url.pathname);
  console.log(args.request.headers);

  const splitUrl = url.pathname.split('/');

  // let team: TGetTeamByUrlResponse | null = null;

  const session = await getSession(args.request);

  // if (session.isAuthenticated && splitUrl[1] === 't' && splitUrl[2]) {
  //   const teamUrl = splitUrl[2];

  //   team = await getTeamByUrl({ userId: session.user.id, teamUrl });
  // }

  return {
    session: {
      ...session,
      // currentUser:
      // currentTeam: team,
    },
    url: args.request.url,
    extra: 'stuff',
  };
}
