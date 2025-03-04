import { Outlet, redirect } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { getLimits } from '@documenso/ee/server-only/limits/client';
import { LimitsProvider } from '@documenso/ee/server-only/limits/provider/client';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { getSiteSettings } from '@documenso/lib/server-only/site-settings/get-site-settings';
import { SITE_SETTINGS_BANNER_ID } from '@documenso/lib/server-only/site-settings/schemas/banner';

import { AppBanner } from '~/components/general/app-banner';
import { Header } from '~/components/general/app-header';
import { VerifyEmailBanner } from '~/components/general/verify-email-banner';

import type { Route } from './+types/_layout';

/**
 * Don't revalidate (run the loader on sequential navigations)
 *
 * Update values via providers.
 */
export const shouldRevalidate = () => false;

export async function loader({ request }: Route.LoaderArgs) {
  const requestHeaders = Object.fromEntries(request.headers.entries());

  const session = await getOptionalSession(request);

  if (!session.isAuthenticated) {
    throw redirect('/signin');
  }

  const [limits, banner] = await Promise.all([
    getLimits({ headers: requestHeaders }),
    getSiteSettings().then((settings) =>
      settings.find((setting) => setting.id === SITE_SETTINGS_BANNER_ID),
    ),
  ]);

  return {
    banner,
    limits,
  };
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { user, teams } = useSession();

  const { banner, limits } = loaderData;

  return (
    <LimitsProvider initialValue={limits}>
      <div id="portal-header"></div>

      {!user.emailVerified && <VerifyEmailBanner email={user.email} />}

      {banner && <AppBanner banner={banner} />}

      <Header user={user} teams={teams} />

      <main className="mt-8 pb-8 md:mt-12 md:pb-12">
        <Outlet />
      </main>
    </LimitsProvider>
  );
}
