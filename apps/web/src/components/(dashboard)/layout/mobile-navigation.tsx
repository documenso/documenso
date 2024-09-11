'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { signOut } from 'next-auth/react';

import LogoImage from '@documenso/assets/logo.png';
import { getRootHref } from '@documenso/lib/utils/params';
import { Sheet, SheetContent } from '@documenso/ui/primitives/sheet';
import { ThemeSwitcher } from '@documenso/ui/primitives/theme-switcher';

export type MobileNavigationProps = {
  isMenuOpen: boolean;
  onMenuOpenChange?: (_value: boolean) => void;
};

export const MobileNavigation = ({ isMenuOpen, onMenuOpenChange }: MobileNavigationProps) => {
  const { _ } = useLingui();

  const params = useParams();

  const handleMenuItemClick = () => {
    onMenuOpenChange?.(false);
  };

  const rootHref = getRootHref(params, { returnEmptyRootString: true });

  const menuNavigationLinks = [
    {
      href: `${rootHref}/documents`,
      text: msg`Documents`,
    },
    {
      href: `${rootHref}/templates`,
      text: msg`Templates`,
    },
    {
      href: '/settings/teams',
      text: msg`Teams`,
    },
    {
      href: '/settings/profile',
      text: msg`Settings`,
    },
  ];

  return (
    <Sheet open={isMenuOpen} onOpenChange={onMenuOpenChange}>
      <SheetContent className="flex w-full max-w-[350px] flex-col">
        <Link href="/" onClick={handleMenuItemClick}>
          <Image
            src={LogoImage}
            alt="Documenso Logo"
            className="dark:invert"
            width={170}
            height={25}
          />
        </Link>

        <div className="mt-8 flex w-full flex-col items-start gap-y-4">
          {menuNavigationLinks.map(({ href, text }) => (
            <Link
              key={href}
              className="text-foreground hover:text-foreground/80 text-2xl font-semibold"
              href={href}
              onClick={() => handleMenuItemClick()}
            >
              {_(text)}
            </Link>
          ))}

          <button
            className="text-foreground hover:text-foreground/80 text-2xl font-semibold"
            onClick={async () =>
              signOut({
                callbackUrl: '/',
              })
            }
          >
            <Trans>Sign Out</Trans>
          </button>
        </div>

        <div className="mt-auto flex w-full flex-col space-y-4 self-end">
          <div className="w-fit">
            <ThemeSwitcher />
          </div>

          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Documenso, Inc. <br /> All rights reserved.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
