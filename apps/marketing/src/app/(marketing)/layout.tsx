import React from 'react';

import { Footer } from '~/components/(marketing)/footer';
import { Header } from '~/components/(marketing)/header';

export type MarketingLayoutProps = {
  children: React.ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="relative max-w-[100vw] overflow-y-auto overflow-x-hidden pt-20 md:pt-28">
      <div className="bg-background/50 fixed left-0 top-0 z-50 w-full backdrop-blur-md">
        <Header className="mx-auto h-16 max-w-screen-xl px-4 md:h-20 lg:px-8" />
      </div>

      <div className="relative mx-auto max-w-screen-xl px-4 lg:px-8">{children}</div>

      <Footer className="mt-24 bg-transparent backdrop-blur-[2px]" />
    </div>
  );
}
