import { Outlet, redirect } from 'react-router';

import { LimitsProvider } from '@documenso/ee/server-only/limits/provider/client';

import { Header } from '~/components/(dashboard)/layout/header';
import { VerifyEmailBanner } from '~/components/(dashboard)/layout/verify-email-banner';

import type { Route } from './+types/_layout';

export const loader = ({ context }: Route.LoaderArgs) => {
  const { session } = context;

  if (!session) {
    throw redirect('/signin');
  }

  return {
    user: session.user,
    teams: session.teams,
  };
};

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { user, teams } = loaderData;

  return (
    <LimitsProvider>
      {!user.emailVerified && <VerifyEmailBanner email={user.email} />}

      {/* // Todo: Banner */}
      {/* <Banner /> */}

      <Header user={user} teams={teams} />

      <main className="mt-8 pb-8 md:mt-12 md:pb-12">
        <Outlet />
      </main>
    </LimitsProvider>
  );
}
