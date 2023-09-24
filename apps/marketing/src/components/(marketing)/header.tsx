'use client';

import { HTMLAttributes, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@documenso/ui/lib/utils';

import { HamburgerMenu } from './mobile-hamburger';
import { MobileNavigation } from './mobile-navigation';

export type HeaderProps = HTMLAttributes<HTMLElement>;

export const Header = ({ className, ...props }: HeaderProps) => {
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false);

  return (
    <header className={cn('flex items-center justify-between', className)} {...props}>
      <Link href="/" className="z-10" onClick={() => setIsHamburgerMenuOpen(false)}>
        <Image
          src="/logo.png"
          alt="Documenso Logo"
          className="dark:invert"
          width={170}
          height={25}
        />
      </Link>

      <div className="hidden items-center gap-x-6 md:flex">
        <Link
          href="/pricing"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          Pricing
        </Link>

        <Link
          href="/blog"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          Blog
        </Link>

        <Link
          href="/open"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          Open
        </Link>

        <Link
          href="https://app.documenso.com/login"
          target="_blank"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          Sign in
        </Link>
      </div>

      <HamburgerMenu
        onToggleMenuOpen={() => setIsHamburgerMenuOpen((v) => !v)}
        isMenuOpen={isHamburgerMenuOpen}
      />
      <MobileNavigation
        isMenuOpen={isHamburgerMenuOpen}
        onMenuOpenChange={setIsHamburgerMenuOpen}
      />
    </header>
  );
};
