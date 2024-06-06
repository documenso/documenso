import React from 'react';

import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import type { GetTeamsResponse } from '@documenso/lib/server-only/team/get-teams';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';

import { RefreshOnFocus } from '~/components/(dashboard)/refresh-on-focus/refresh-on-focus';
import { NextAuthProvider } from '~/providers/next-auth';

import { ProfileHeader } from './profile-header';

type PublicProfileLayoutProps = {
  children: React.ReactNode;
};

export default async function PublicProfileLayout({ children }: PublicProfileLayoutProps) {
  const { user, session } = await getServerComponentSession();

  let teams: GetTeamsResponse = [];

  if (user && session) {
    teams = await getTeams({ userId: user.id });
  }

  return (
    <NextAuthProvider session={session}>
      <div className="min-h-screen">
        <ProfileHeader user={user} teams={teams} />

        <main className="mb-8 mt-8 px-4 md:mb-12 md:mt-12 md:px-8">{children}</main>
      </div>

      <RefreshOnFocus />
    </NextAuthProvider>
  );
}
