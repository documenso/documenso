import { getLoaderTeamSession } from 'server/utils/get-loader-session';

import { getTeamPublicProfile } from '@documenso/lib/server-only/team/get-team-public-profile';

import PublicProfilePage from '~/routes/_authenticated+/settings+/public-profile+/index';

export async function loader() {
  const { user, currentTeam: team } = getLoaderTeamSession();

  const { profile } = await getTeamPublicProfile({
    userId: user.id,
    teamId: team.id,
  });

  return {
    profile,
  };
}

// Todo: Test that the profile shows up correctly for teams.
export default PublicProfilePage;
