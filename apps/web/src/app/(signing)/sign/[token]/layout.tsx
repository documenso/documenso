import React from 'react';

import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-session';

import { Header as AuthenticatedHeader } from '~/components/(dashboard)/layout/header';
import { NextAuthProvider } from '~/providers/next-auth';

export type SigningLayoutProps = {
  children: React.ReactNode;
};

export default async function SigningLayout({ children }: SigningLayoutProps) {
  const user = await getServerComponentSession();

  return (
    <NextAuthProvider>
      <div className="min-h-screen overflow-hidden">
        {user && <AuthenticatedHeader user={user} />}

        <main className="mb-8 mt-8 px-4 md:mb-12 md:mt-12 md:px-8">{children}</main>
      </div>
    </NextAuthProvider>
  );
}
