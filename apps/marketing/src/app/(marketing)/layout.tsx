'use client';

import React, { useEffect, useState } from 'react';

import Image from 'next/image';
import { usePathname } from 'next/navigation';

import backgroundPattern from '@documenso/assets/images/background-lw-2.png';
import { cn } from '@documenso/ui/lib/utils';
import { AnnouncementBar } from '@documenso/ui/primitives/announcement-bar';

import { Footer } from '~/components/(marketing)/footer';
import { Header } from '~/components/(marketing)/header';

export type MarketingLayoutProps = {
  children: React.ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  const [scrollY, setScrollY] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', onScroll);

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={cn('relative flex min-h-[100vh] max-w-[100vw] flex-col pt-20 md:pt-28', {
        'overflow-y-auto overflow-x-hidden': pathname !== '/singleplayer',
      })}
    >
      <div
        className={cn('fixed left-0 top-0 z-50 w-full bg-transparent', {
          'bg-background/50 backdrop-blur-md': scrollY > 5,
        })}
      >
        <div className="absolute -inset-0 -z-[1] opacity-100">
          <Image
            src={backgroundPattern}
            alt="background pattern"
            className="h-[2rem] w-full object-cover"
          />
        </div>
        <AnnouncementBar className="relative" isShown={true} />
        <Header className="mx-auto h-16 max-w-screen-xl px-4 md:h-20 lg:px-8" />
      </div>

      <div className="relative max-w-screen-xl flex-1 px-4 sm:mx-auto lg:px-8">{children}</div>

      <Footer className="bg-background border-muted mt-24 border-t" />
    </div>
  );
}
