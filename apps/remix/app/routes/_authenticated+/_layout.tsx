import { Outlet } from 'react-router';
import { getLoaderSession } from 'server/utils/get-loader-session';

import { getLimits } from '@documenso/ee/server-only/limits/client';
import { LimitsProvider } from '@documenso/ee/server-only/limits/provider/client';
import { getSiteSettings } from '@documenso/lib/server-only/site-settings/get-site-settings';
import { SITE_SETTINGS_BANNER_ID } from '@documenso/lib/server-only/site-settings/schemas/banner';

import { AppBanner } from '~/components/general/app-banner';
import { Header } from '~/components/general/app-header';
import { VerifyEmailBanner } from '~/components/general/verify-email-banner';

import type { Route } from './+types/_layout';

export const loader = async ({ request }: Route.LoaderArgs) => {
  const { user, teams, currentTeam } = getLoaderSession();

  const requestHeaders = Object.fromEntries(request.headers.entries());

  // Todo: Should only load this on first render.
  const [limits, banner] = await Promise.all([
    getLimits({ headers: requestHeaders, teamId: currentTeam?.id }),
    getSiteSettings().then((settings) =>
      settings.find((setting) => setting.id === SITE_SETTINGS_BANNER_ID),
    ),
  ]);

  return {
    user,
    teams,
    banner,
    limits,
    teamId: currentTeam?.id,
  };
};

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { user, teams, banner, limits, teamId } = loaderData;

  return (
    <LimitsProvider initialValue={limits} teamId={teamId}>
      {!user.emailVerified && <VerifyEmailBanner email={user.email} />}

      {banner && <AppBanner banner={banner} />}

      <Header user={user} teams={teams} />

      <main className="mt-8 pb-8 md:mt-12 md:pb-12">
        <Outlet />
      </main>
    </LimitsProvider>
  );
}
