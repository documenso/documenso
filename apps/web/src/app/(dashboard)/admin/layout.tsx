import React from 'react';

import { redirect } from 'next/navigation';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { isAdmin } from '@documenso/lib/next-auth/guards/is-admin';

import { AdminNav } from './nav';

export type AdminSectionLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminSectionLayout({ children }: AdminSectionLayoutProps) {
  const { user } = await getRequiredServerComponentSession();

  if (!isAdmin(user)) {
    redirect('/documents');
  }

  return (
    <div className="mx-auto mt-16 w-full max-w-screen-xl px-4 md:px-8">
      <div className="grid grid-cols-12 md:mt-8 md:gap-8">
        <AdminNav className="col-span-12 md:col-span-3 md:flex" />

        <div className="col-span-12 mt-12 md:col-span-9 md:mt-0">{children}</div>
      </div>
    </div>
  );
}
