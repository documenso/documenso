import { Trans } from '@lingui/macro';
import { Outlet } from 'react-router';

import { getRequiredSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { canExecuteTeamAction } from '@documenso/lib/utils/teams';

import { TeamSettingsDesktopNav } from '~/components/pages/teams/team-settings-desktop-nav';
import { TeamSettingsMobileNav } from '~/components/pages/teams/team-settings-mobile-nav';

import type { Route } from '../+types/_layout';

export async function loader({ request, params }: Route.LoaderArgs) {
  // Todo: Get from parent loaders...
  const { user } = await getRequiredSession(request);
  const teamUrl = params.teamUrl;

  try {
    const team = await getTeamByUrl({ userId: user.id, teamUrl });

    if (!canExecuteTeamAction('MANAGE_TEAM', team.currentTeamMember.role)) {
      // Unauthorized.
      throw new Response(null, { status: 401 }); // Todo: Test
    }
  } catch (e) {
    const error = AppError.parseError(e);

    if (error.code === AppErrorCode.NOT_FOUND) {
      throw new Response(null, { status: 404 }); // Todo: Test
    }

    throw e;
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
