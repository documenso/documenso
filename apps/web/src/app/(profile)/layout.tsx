import React from 'react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';

import { RefreshOnFocus } from '~/components/(dashboard)/refresh-on-focus/refresh-on-focus';
import { NextAuthProvider } from '~/providers/next-auth';

import { ProfileHeader } from './profile-header';

type PublicProfileLayoutProps = {
  children: React.ReactNode;
};

export default async function PublicProfileLayout({ children }: PublicProfileLayoutProps) {
  await setupI18nSSR();

  const { user, session } = await getServerComponentSession();

  // I wouldn't typically do this but it's better than the `let` statement
  const teams = user && session ? await getTeams({ userId: user.id }) : undefined;

  return (
    <NextAuthProvider session={session}>
      <div className="min-h-screen">
        <ProfileHeader user={user} teams={teams} />

        <main className="my-8 px-4 md:my-12 md:px-8">{children}</main>
      </div>

      <RefreshOnFocus />
    </NextAuthProvider>
  );
}
