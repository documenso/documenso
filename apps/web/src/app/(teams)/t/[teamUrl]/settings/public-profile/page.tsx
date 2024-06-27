import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { getTeamPublicProfile } from '@documenso/lib/server-only/team/get-team-public-profile';

import { PublicProfilePageView } from '~/app/(dashboard)/settings/public-profile/public-profile-page-view';

export type TeamsSettingsPublicProfilePageProps = {
  params: {
    teamUrl: string;
  };
};

export default async function TeamsSettingsPublicProfilePage({
  params,
}: TeamsSettingsPublicProfilePageProps) {
  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();

  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  const { profile } = await getTeamPublicProfile({
    userId: user.id,
    teamId: team.id,
  });

  return <PublicProfilePageView user={user} team={team} profile={profile} />;
}
