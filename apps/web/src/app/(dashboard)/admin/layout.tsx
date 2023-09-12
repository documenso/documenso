import React from 'react';

import { AdminNav } from './nav';

export type AdminSectionLayoutProps = {
  children: React.ReactNode;
};

export default function AdminSectionLayout({ children }: AdminSectionLayoutProps) {
  return (
    <div className="mx-auto mt-16 w-full max-w-screen-xl px-4 md:px-8">
      <div className="grid grid-cols-12 gap-x-8 md:mt-8">
        <AdminNav className="col-span-12 md:col-span-3 md:flex" />

        <div className="col-span-12 mt-12 md:col-span-9 md:mt-0">{children}</div>
      </div>
    </div>
  );
}
