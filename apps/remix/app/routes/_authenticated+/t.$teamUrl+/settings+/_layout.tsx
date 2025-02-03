import { Trans } from '@lingui/macro';
import { Outlet } from 'react-router';
import { getRequiredTeamSessionContext } from 'server/utils/get-required-session-context';

import { canExecuteTeamAction } from '@documenso/lib/utils/teams';

import { TeamSettingsDesktopNav } from '~/components/general/teams/team-settings-desktop-nav';
import { TeamSettingsMobileNav } from '~/components/general/teams/team-settings-mobile-nav';

import type { Route } from '../+types/_layout';

export async function loader({ context }: Route.LoaderArgs) {
  const { currentTeam: team } = getRequiredTeamSessionContext(context);

  // Todo: Test that 404 page shows up from error.
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
        <TeamSettingsDesktopNav className="hidden md:col-span-3 md:flex" />
        <TeamSettingsMobileNav className="col-span-12 mb-8 md:hidden" />

        <div className="col-span-12 md:col-span-9">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
