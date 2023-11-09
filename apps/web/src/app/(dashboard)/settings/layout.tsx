import React from 'react';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { isTwoFactorAuthEnabled } from '@documenso/lib/server-only/2fa/is-2fa-availble';

import { DesktopNav } from '~/components/(dashboard)/settings/layout/desktop-nav';
import { MobileNav } from '~/components/(dashboard)/settings/layout/mobile-nav';

export type DashboardSettingsLayoutProps = {
  children: React.ReactNode;
};

export default async function DashboardSettingsLayout({ children }: DashboardSettingsLayoutProps) {
  const { user } = await getRequiredServerComponentSession();

  const isTwoFactorAuthEnabled_ = isTwoFactorAuthEnabled({ user });
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <h1 className="text-4xl font-semibold">Settings</h1>

      <div className="mt-4 grid grid-cols-12 gap-x-8 md:mt-8">
        <DesktopNav
          isTwoFactorAuthEnabled={isTwoFactorAuthEnabled_}
          className="hidden md:col-span-3 md:flex"
        />
        <MobileNav
          isTwoFactorAuthEnabled={isTwoFactorAuthEnabled_}
          className="col-span-12 mb-8 md:hidden"
        />

        <div className="col-span-12 md:col-span-9">{children}</div>
      </div>
    </div>
  );
}
