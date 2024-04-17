import React from 'react';

import { RefreshOnFocus } from '~/components/(dashboard)/refresh-on-focus/refresh-on-focus';

export type SigningLayoutProps = {
  children: React.ReactNode;
};

export default function SigningLayout({ children }: SigningLayoutProps) {
  return (
    <div>
      {children}

      <RefreshOnFocus />
    </div>
  );
}
