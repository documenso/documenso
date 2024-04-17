import React from 'react';

import { redirect } from 'next/navigation';

import { getServerSession } from 'next-auth';

import { LimitsProvider } from '@documenso/ee/server-only/limits/provider/server';
import { NEXT_AUTH_OPTIONS } from '@documenso/lib/next-auth/auth-options';
<<<<<<< HEAD
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';

import { Header } from '~/components/(dashboard)/layout/header';
=======
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';

import { Banner } from '~/components/(dashboard)/layout/banner';
import { Header } from '~/components/(dashboard)/layout/header';
import { VerifyEmailBanner } from '~/components/(dashboard)/layout/verify-email-banner';
>>>>>>> main
import { RefreshOnFocus } from '~/components/(dashboard)/refresh-on-focus/refresh-on-focus';
import { NextAuthProvider } from '~/providers/next-auth';

export type AuthenticatedDashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function AuthenticatedDashboardLayout({
  children,
}: AuthenticatedDashboardLayoutProps) {
  const session = await getServerSession(NEXT_AUTH_OPTIONS);

  if (!session) {
    redirect('/signin');
  }

<<<<<<< HEAD
  const { user } = await getRequiredServerComponentSession();
=======
  const [{ user }, teams] = await Promise.all([
    getRequiredServerComponentSession(),
    getTeams({ userId: session.user.id }),
  ]);
>>>>>>> main

  return (
    <NextAuthProvider session={session}>
      <LimitsProvider>
<<<<<<< HEAD
        <Header user={user} />
=======
        {!user.emailVerified && <VerifyEmailBanner email={user.email} />}

        <Banner />

        <Header user={user} teams={teams} />
>>>>>>> main

        <main className="mt-8 pb-8 md:mt-12 md:pb-12">{children}</main>

        <RefreshOnFocus />
      </LimitsProvider>
    </NextAuthProvider>
  );
}
