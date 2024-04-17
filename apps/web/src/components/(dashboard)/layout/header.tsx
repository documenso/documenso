'use client';

<<<<<<< HEAD
import { HTMLAttributes, useEffect, useState } from 'react';

import Link from 'next/link';

import { User } from '@documenso/prisma/client';
=======
import { type HTMLAttributes, useEffect, useState } from 'react';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { MenuIcon, SearchIcon } from 'lucide-react';

import type { GetTeamsResponse } from '@documenso/lib/server-only/team/get-teams';
import { getRootHref } from '@documenso/lib/utils/params';
import type { User } from '@documenso/prisma/client';
>>>>>>> main
import { cn } from '@documenso/ui/lib/utils';

import { Logo } from '~/components/branding/logo';

<<<<<<< HEAD
import { DesktopNav } from './desktop-nav';
import { ProfileDropdown } from './profile-dropdown';

export type HeaderProps = HTMLAttributes<HTMLDivElement> & {
  user: User;
};

export const Header = ({ className, user, ...props }: HeaderProps) => {
=======
import { CommandMenu } from '../common/command-menu';
import { DesktopNav } from './desktop-nav';
import { MenuSwitcher } from './menu-switcher';
import { MobileNavigation } from './mobile-navigation';

export type HeaderProps = HTMLAttributes<HTMLDivElement> & {
  user: User;
  teams: GetTeamsResponse;
};

export const Header = ({ className, user, teams, ...props }: HeaderProps) => {
  const params = useParams();

  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false);
>>>>>>> main
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
<<<<<<< HEAD
        'supports-backdrop-blur:bg-background/60 bg-background/95 sticky top-0 z-50 flex h-16 w-full items-center border-b border-b-transparent backdrop-blur duration-200',
=======
        'supports-backdrop-blur:bg-background/60 bg-background/95 sticky top-0 z-[60] flex h-16 w-full items-center border-b border-b-transparent backdrop-blur duration-200',
>>>>>>> main
        scrollY > 5 && 'border-b-border',
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-x-4 px-4 md:justify-normal md:px-8">
        <Link
<<<<<<< HEAD
          href="/"
          className="focus-visible:ring-ring ring-offset-background rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
=======
          href={`${getRootHref(params, { returnEmptyRootString: true })}/documents`}
          className="focus-visible:ring-ring ring-offset-background hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:inline"
>>>>>>> main
        >
          <Logo className="h-6 w-auto" />
        </Link>

<<<<<<< HEAD
        <DesktopNav />

        <div className="flex gap-x-4">
          <ProfileDropdown user={user} />

          {/* <Button variant="outline" size="sm" className="h-10 w-10 p-0.5 md:hidden">
            <Menu className="h-6 w-6" />
          </Button> */}
=======
        <DesktopNav setIsCommandMenuOpen={setIsCommandMenuOpen} />

        <div className="flex gap-x-4 md:ml-8">
          <MenuSwitcher user={user} teams={teams} />
        </div>

        <div className="flex flex-row items-center space-x-4 md:hidden">
          <button onClick={() => setIsCommandMenuOpen(true)}>
            <SearchIcon className="text-muted-foreground h-6 w-6" />
          </button>

          <button onClick={() => setIsHamburgerMenuOpen(true)}>
            <MenuIcon className="text-muted-foreground h-6 w-6" />
          </button>

          <CommandMenu open={isCommandMenuOpen} onOpenChange={setIsCommandMenuOpen} />

          <MobileNavigation
            isMenuOpen={isHamburgerMenuOpen}
            onMenuOpenChange={setIsHamburgerMenuOpen}
          />
>>>>>>> main
        </div>
      </div>
    </header>
  );
};
