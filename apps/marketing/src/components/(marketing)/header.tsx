'use client';

import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import LogoImage from '@documenso/assets/IPOGRAFI.svg';
// import LogoImage from '@documenso/assets/logo.png';
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
            alt="Ipografi Logo"
            className="dark:invert"
            width={230}
            height={30}
          />
        </Link>

        {isSinglePlayerModeMarketingEnabled && (
          <Link
            href="/singleplayer"
            className="bg-primary dark:text-background rounded-full px-2 py-1 text-xs font-semibold sm:px-3"
          >
            სცადეთ დღესვე!
          </Link>
        )}
      </div>

      <div className="hidden items-center gap-x-6 md:flex">
        <Link
          href="/pricing"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          ფასი
        </Link>

        <Link
          href="/blog"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          ბლოგი
        </Link>

        <Link
          href="/open"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          გამოყენებები
        </Link>

        <Link
          href="https://app.documenso.com/signin?utm_source=marketing-header"
          target="_blank"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          ავტორიზაცია
        </Link>

        <Button className="rounded-full" size="sm" asChild>
          <Link href="https://app.documenso.com/signup?utm_source=marketing-header" target="_blank">
            რეგისტრაცია
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
