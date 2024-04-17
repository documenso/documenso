'use client';

import { HTMLAttributes, useEffect, useState } from 'react';

import Link from 'next/link';

import { User } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';

import { Logo } from '~/components/branding/logo';

import { DesktopNav } from './desktop-nav';
import { ProfileDropdown } from './profile-dropdown';

export type HeaderProps = HTMLAttributes<HTMLDivElement> & {
  user: User;
};

export const Header = ({ className, user, ...props }: HeaderProps) => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', onScroll);

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'supports-backdrop-blur:bg-background/60 bg-background/95 sticky top-0 z-50 flex h-16 w-full items-center border-b border-b-transparent backdrop-blur duration-200',
        scrollY > 5 && 'border-b-border',
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-x-4 px-4 md:justify-normal md:px-8">
        <Link
          href="/"
          className="focus-visible:ring-ring ring-offset-background rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <Logo className="h-6 w-auto" />
        </Link>

        <DesktopNav />

        <div className="flex gap-x-4">
          <ProfileDropdown user={user} />

          {/* <Button variant="outline" size="sm" className="h-10 w-10 p-0.5 md:hidden">
            <Menu className="h-6 w-6" />
          </Button> */}
        </div>
      </div>
    </header>
  );
};
