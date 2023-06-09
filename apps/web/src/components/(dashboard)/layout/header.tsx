'use client';

import { HTMLAttributes } from 'react';

import Link from 'next/link';

import { Menu } from 'lucide-react';

import { User } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { Logo } from '~/components/branding/logo';

import { DesktopNav } from './desktop-nav';
import { ProfileDropdown } from './profile-dropdown';

export type HeaderProps = HTMLAttributes<HTMLDivElement> & {
  user: User;
};

export const Header = ({ className, user, ...props }: HeaderProps) => {
  return (
    <header
      className={cn(
        'supports-backdrop-blur:bg-background/60 bg-background/95 sticky top-0 z-40 flex h-16 w-full items-center border-b backdrop-blur',
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-x-4 px-4 md:justify-normal md:px-8">
        <Link href="/">
          <Logo className="h-6 w-auto" />
        </Link>

        <DesktopNav />

        <div className="flex gap-x-4">
          <ProfileDropdown user={user} />

          <Button variant="outline" size="sm" className="h-10 w-10 p-0.5 md:hidden">
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </header>
  );
};
