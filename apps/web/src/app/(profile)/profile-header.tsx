'use client';

import { useEffect, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { PlusIcon } from 'lucide-react';

import LogoIcon from '@documenso/assets/logo_icon.png';
import type { GetTeamsResponse } from '@documenso/lib/server-only/team/get-teams';
import type { User } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { Header as AuthenticatedHeader } from '~/components/(dashboard)/layout/header';
import { Logo } from '~/components/branding/logo';

type ProfileHeaderProps = {
  user?: User | null;
  teams?: GetTeamsResponse;
};

export const ProfileHeader = ({ user, teams = [] }: ProfileHeaderProps) => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', onScroll);

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (user) {
    return <AuthenticatedHeader user={user} teams={teams} />;
  }

  return (
    <header
      className={cn(
        'supports-backdrop-blur:bg-background/60 bg-background/95 sticky top-0 z-[60] flex h-16 w-full items-center border-b border-b-transparent backdrop-blur duration-200',
        scrollY > 5 && 'border-b-border',
      )}
    >
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-x-4 px-4 md:px-8">
        <Link
          href="/"
          className="focus-visible:ring-ring ring-offset-background rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:inline"
        >
          <Logo className="hidden h-6 w-auto sm:block" />

          <Image
            src={LogoIcon}
            alt="Documenso Logo"
            width={48}
            height={48}
            className="h-10 w-auto dark:invert sm:hidden"
          />
        </Link>

        <div className="flex flex-row items-center justify-center">
          <p className="text-muted-foreground mr-4">
            <span className="text-sm sm:hidden">Want your own public profile?</span>
            <span className="hidden text-sm sm:block">
              Like to have your own public profile with agreements?
            </span>
          </p>

          <Button asChild variant="secondary">
            <Link href="/signup">
              <div className="hidden flex-row items-center sm:flex">
                <PlusIcon className="mr-1 h-5 w-5" />
                Create now
              </div>

              <span className="sm:hidden">Create</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
};
