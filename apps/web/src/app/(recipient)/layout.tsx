import React from 'react';

import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import type { GetTeamsResponse } from '@documenso/lib/server-only/team/get-teams';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';

import { Header as AuthenticatedHeader } from '~/components/(dashboard)/layout/header';
import { NextAuthProvider } from '~/providers/next-auth';

type RecipientLayoutProps = {
  children: React.ReactNode;
};

/**
 * A layout to handle scenarios where the user is a recipient of a given resource
 * where we do not care whether they are authenticated or not.
 *
 * Such as direct template access, or signing.
 */
export default async function RecipientLayout({ children }: RecipientLayoutProps) {
  const { user, session } = await getServerComponentSession();

  let teams: GetTeamsResponse = [];

  if (user && session) {
    teams = await getTeams({ userId: user.id });
  }

  return (
    <NextAuthProvider session={session}>
      <div className="min-h-screen">
        {user && <AuthenticatedHeader user={user} teams={teams} />}

        <main className="mb-8 mt-8 px-4 md:mb-12 md:mt-12 md:px-8">{children}</main>
      </div>
    </NextAuthProvider>
  );
}
