import { Outlet } from 'react-router';
import { redirect } from 'react-router';

import { LimitsProvider } from '@documenso/ee/server-only/limits/provider/client';
import { SessionProvider } from '@documenso/lib/client-only/providers/session';

import { Header } from '~/components/(dashboard)/layout/header';
import { VerifyEmailBanner } from '~/components/(dashboard)/layout/verify-email-banner';

import type { Route } from './+types/_layout';

export const loader = ({ context }: Route.LoaderArgs) => {
  const { session } = context;

  if (!session) {
    return redirect('/signin');
  }

  return {
    user: session.user,
    session: session.session,
    teams: session.teams,
  };
};

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { user, session, teams } = loaderData;

  return (
    <SessionProvider session={session} user={user}>
      <LimitsProvider>
        {!user.emailVerified && <VerifyEmailBanner email={user.email} />}

        {/* // Todo: Banner */}
        {/* <Banner /> */}

        <Header user={user} teams={teams} />

        <main className="mt-8 pb-8 md:mt-12 md:pb-12">
          <Outlet />
        </main>
      </LimitsProvider>
    </SessionProvider>
  );
}
