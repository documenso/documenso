import React from 'react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { RefreshOnFocus } from '~/components/(dashboard)/refresh-on-focus/refresh-on-focus';

export type SigningLayoutProps = {
  children: React.ReactNode;
};

export default async function SigningLayout({ children }: SigningLayoutProps) {
  await setupI18nSSR();

  return (
    <div>
      {children}

      <RefreshOnFocus />
    </div>
  );
}
