import { Trans } from '@lingui/react/macro';
import { Outlet } from 'react-router';
import { getLoaderTeamSession } from 'server/utils/get-loader-session';

import { canExecuteTeamAction } from '@documenso/lib/utils/teams';

import { TeamSettingsNavDesktop } from '~/components/general/teams/team-settings-nav-desktop';
import { TeamSettingsNavMobile } from '~/components/general/teams/team-settings-nav-mobile';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Team Settings');
}

export function loader() {
  const { currentTeam: team } = getLoaderTeamSession();

  if (!team || !canExecuteTeamAction('MANAGE_TEAM', team.currentTeamMember.role)) {
    throw new Response(null, { status: 401 }); // Unauthorized.
  }
}

export default function TeamsSettingsLayout() {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <h1 className="text-4xl font-semibold">
        <Trans>Team Settings</Trans>
      </h1>

      <div className="mt-4 grid grid-cols-12 gap-x-8 md:mt-8">
        <TeamSettingsNavDesktop className="hidden md:col-span-3 md:flex" />
        <TeamSettingsNavMobile className="col-span-12 mb-8 md:hidden" />

        <div className="col-span-12 md:col-span-9">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
