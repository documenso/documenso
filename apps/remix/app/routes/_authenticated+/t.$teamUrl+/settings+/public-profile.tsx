import { getRequiredSession } from '@documenso/auth/server/lib/utils/get-session';
import { getTeamPublicProfile } from '@documenso/lib/server-only/team/get-team-public-profile';

import PublicProfilePage from '~/routes/_authenticated+/settings+/public-profile+/index';

import type { Route } from './+types/public-profile';

export async function loader({ request }: Route.LoaderArgs) {
  // Todo: Pull from...
  const team = { id: 1 };
  const { user } = await getRequiredSession(request);

  const { profile } = await getTeamPublicProfile({
    userId: user.id,
    teamId: team.id,
  });

  return {
    profile,
  };
}

export default PublicProfilePage;
