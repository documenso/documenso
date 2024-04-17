import React from 'react';

<<<<<<< HEAD
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
=======
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import type { GetTeamsResponse } from '@documenso/lib/server-only/team/get-teams';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';
>>>>>>> main

import { Header as AuthenticatedHeader } from '~/components/(dashboard)/layout/header';
import { NextAuthProvider } from '~/providers/next-auth';

export type SigningLayoutProps = {
  children: React.ReactNode;
};

export default async function SigningLayout({ children }: SigningLayoutProps) {
  const { user, session } = await getServerComponentSession();

<<<<<<< HEAD
  return (
    <NextAuthProvider session={session}>
      <div className="min-h-screen">
        {user && <AuthenticatedHeader user={user} />}
=======
  let teams: GetTeamsResponse = [];

  if (user && session) {
    teams = await getTeams({ userId: user.id });
  }

  return (
    <NextAuthProvider session={session}>
      <div className="min-h-screen">
        {user && <AuthenticatedHeader user={user} teams={teams} />}
>>>>>>> main

        <main className="mb-8 mt-8 px-4 md:mb-12 md:mt-12 md:px-8">{children}</main>
      </div>
    </NextAuthProvider>
  );
}
