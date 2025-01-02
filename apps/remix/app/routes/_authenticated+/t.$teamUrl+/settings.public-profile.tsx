import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { getTeamPublicProfile } from '@documenso/lib/server-only/team/get-team-public-profile';

import PublicProfilePage from '~/routes/_authenticated+/settings+/public-profile';

import type { Route } from './+types/settings.public-profile';

// Todo: This can be optimized.
export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getSession(request);

  const team = await getTeamByUrl({
    userId: session.user.id,
    teamUrl: params.teamUrl,
  });

  const { profile } = await getTeamPublicProfile({
    userId: session.user.id,
    teamId: team.id,
  });

  return {
    profile,
  };
}

// Todo: Test that the profile shows up correctly for teams.
export default PublicProfilePage;
