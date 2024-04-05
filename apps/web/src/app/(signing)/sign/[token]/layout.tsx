import React from 'react';

import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import type { GetTeamsResponse } from '@documenso/lib/server-only/team/get-teams';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';
import { cn } from '@documenso/ui/lib/utils';

import { Header as AuthenticatedHeader } from '~/components/(dashboard)/layout/header';
import { NextAuthProvider } from '~/providers/next-auth';

export type SigningLayoutProps = {
  children: React.ReactNode;
};

export default async function SigningLayout({ children }: SigningLayoutProps) {
  const { user, session } = await getServerComponentSession();

  let teams: GetTeamsResponse = [];

  if (user && session) {
    teams = await getTeams({ userId: user.id });
  }

  const isLoggedIn = (!!user && !!session) || !!teams.length;

  return (
    <NextAuthProvider session={session}>
      <div className="min-h-screen">
        {user && <AuthenticatedHeader user={user} teams={teams} />}

        <main className={cn('px-4 md:px-8', { 'mb-8 mt-8 md:mb-12 md:mt-12': isLoggedIn })}>
          {children}
        </main>
      </div>
    </NextAuthProvider>
  );
}
