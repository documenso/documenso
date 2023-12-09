import React from 'react';

import { redirect } from 'next/navigation';

import { getServerSession } from 'next-auth';

import { NEXT_AUTH_OPTIONS } from '@documenso/lib/next-auth/auth-options';

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

  return <NextAuthProvider session={session}>{children}</NextAuthProvider>;
}
