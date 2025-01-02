import { Outlet } from 'react-router';
import { redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { LimitsProvider } from '@documenso/ee/server-only/limits/provider/client';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';

import { Header } from '~/components/(dashboard)/layout/header';
import { VerifyEmailBanner } from '~/components/(dashboard)/layout/verify-email-banner';
import { AuthProvider } from '~/providers/auth';

import type { Route } from './+types/_layout';

export const loader = async ({ request }: Route.LoaderArgs) => {
  const { session, user, isAuthenticated } = await getSession(request);

  if (!isAuthenticated) {
    return redirect('/signin');
  }

  const teams = await getTeams({ userId: user.id });

  return {
    user,
    session,
    teams,
  };
};

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { user, session, teams } = loaderData;

  return (
    <AuthProvider session={session} user={user}>
      <LimitsProvider>
        {!user.emailVerified && <VerifyEmailBanner email={user.email} />}

        {/* // Todo: Banner */}
        {/* <Banner /> */}

        <Header user={user} teams={teams} />

        <main className="mt-8 pb-8 md:mt-12 md:pb-12">
          <Outlet />
        </main>
      </LimitsProvider>
    </AuthProvider>
  );
}
