import React from 'react';

import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { DesktopNav } from '~/components/(dashboard)/settings/layout/desktop-nav';
import { MobileNav } from '~/components/(dashboard)/settings/layout/mobile-nav';

export type DashboardSettingsLayoutProps = {
  children: React.ReactNode;
};

export default function DashboardSettingsLayout({ children }: DashboardSettingsLayoutProps) {
  setupI18nSSR();

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <h1 className="text-4xl font-semibold">
        <Trans>Settings</Trans>
      </h1>

      <div className="mt-4 grid grid-cols-12 gap-x-8 md:mt-8">
        <DesktopNav className="hidden md:col-span-3 md:flex" />
        <MobileNav className="col-span-12 mb-8 md:hidden" />

        <div className="col-span-12 md:col-span-9">{children}</div>
      </div>
    </div>
  );
}
