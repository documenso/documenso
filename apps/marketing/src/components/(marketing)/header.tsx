'use client';

import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { Trans } from '@lingui/macro';

import LogoImage from '@documenso/assets/logo.png';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { HamburgerMenu } from './mobile-hamburger';
import { MobileNavigation } from './mobile-navigation';

export type HeaderProps = HTMLAttributes<HTMLElement>;

export const Header = ({ className, ...props }: HeaderProps) => {
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
          href="/pricing"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          <Trans>Pricing</Trans>
        </Link>

        <Link
          href="https://documen.so/docs-header"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
          target="_blank"
        >
          Documentation
        </Link>

        <Link
          href="/blog"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          <Trans>Blog</Trans>
        </Link>

        <Link
          href="/open"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          <Trans>Open Startup</Trans>
        </Link>

        <Link
          href="https://app.documenso.com/signin?utm_source=marketing-header"
          target="_blank"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          <Trans>Sign in</Trans>
        </Link>

        <Button className="rounded-full" size="sm" asChild>
          <Link href="https://app.documenso.com/signup?utm_source=marketing-header" target="_blank">
            <Trans>Sign up</Trans>
          </Link>
        </Button>
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
