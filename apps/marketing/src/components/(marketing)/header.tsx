'use client';

import { HTMLAttributes, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import LogoImage from '@documenso/assets/logo.png';
import ChangeLocale from '@documenso/ui/components/ChangeLocale';
import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
import { cn } from '@documenso/ui/lib/utils';

import { HamburgerMenu } from './mobile-hamburger';
import { MobileNavigation } from './mobile-navigation';

export type HeaderProps = HTMLAttributes<HTMLElement>;

export const Header = ({ className, ...props }: HeaderProps) => {
  const locale = useParams()?.locale as LocaleTypes;
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false);
  const { t } = useTranslation(locale, 'marketing');

  return (
    <header className={cn('flex items-center justify-between', className)} {...props}>
      <div className="flex items-center space-x-4">
        <Link href="/" className="z-10" onClick={() => setIsHamburgerMenuOpen(false)}>
          <Image
            src={LogoImage}
            alt="Notario Logo"
            className="dark:invert"
            width={155}
            height={25}
          />
        </Link>

        <Link
          href={`${locale}/singleplayer`}
          className="bg-primary dark:text-background rounded-full px-2 py-1 text-xs font-semibold sm:px-3"
        >
          {t(`try`)}
        </Link>
      </div>

      <div className="hidden items-center gap-x-6 md:flex">
        <Link
          href={`${locale}/pricing`}
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          {t(`pricing`)}
        </Link>

        <Link
          href={`https://app.progiciel.co/fr/signin`}
          target="_blank"
          className="text-muted-foreground hover:text-muted-foreground/80 text-sm font-semibold"
        >
          {t(`sign-in`)}
        </Link>
        <ChangeLocale />
      </div>

      <HamburgerMenu
        onToggleMenuOpen={() => setIsHamburgerMenuOpen((v) => !v)}
        isMenuOpen={isHamburgerMenuOpen}
      />
      <MobileNavigation
        locale={locale}
        isMenuOpen={isHamburgerMenuOpen}
        onMenuOpenChange={setIsHamburgerMenuOpen}
      />
    </header>
  );
};
