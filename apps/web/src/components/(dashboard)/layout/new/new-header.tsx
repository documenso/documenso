'use client';

import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import LogoImage from '@documenso/assets/logo.png';
import { cn } from '@documenso/ui/lib/utils';

import { NewHamburgerMenu } from './new-mobile-hamburger';
import { NewMobileNavigation } from './new-mobile-navigation';

export type HeaderProps = HTMLAttributes<HTMLElement>;

export const NewHeader = ({ className, ...props }: HeaderProps) => {
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false);

  return (
    <header className={cn('flex items-center justify-between', className)} {...props}>
      <div className="flex items-center space-x-4">
        <Link href="/" className="z-10" onClick={() => setIsHamburgerMenuOpen(false)}>
          <Image
            src={LogoImage}
            alt="Documenso Logo"
            className="dark:invert"
            width={170}
            height={25}
          />
        </Link>
      </div>

      <div className="hidden items-center gap-x-6 md:flex">
        <Link
          href="https://documenso.com/pricing"
          target="_blank"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          Pricing
        </Link>

        <Link
          href="https://documenso.com/blog"
          target="_blank"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          Blog
        </Link>

        <Link
          href="https://documenso.com/open"
          target="_blank"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          Open Startup
        </Link>

        <Link
          href="/signin"
          target="_blank"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          target="_blank"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          <span className="bg-primary dark:text-background rounded-full px-3 py-2 text-xs">
            Sign up
          </span>
        </Link>
      </div>

      <NewHamburgerMenu
        onToggleMenuOpen={() => setIsHamburgerMenuOpen((v) => !v)}
        isMenuOpen={isHamburgerMenuOpen}
      />
      <NewMobileNavigation
        isMenuOpen={isHamburgerMenuOpen}
        onMenuOpenChange={setIsHamburgerMenuOpen}
      />
    </header>
  );
};
