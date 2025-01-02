import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Link, useParams } from 'react-router';

import LogoImage from '@documenso/assets/logo.png';
import { authClient } from '@documenso/auth/client';
import { getRootHref } from '@documenso/lib/utils/params';
import { Sheet, SheetContent } from '@documenso/ui/primitives/sheet';
import { ThemeSwitcher } from '@documenso/ui/primitives/theme-switcher';

export type AppNavMobileProps = {
  isMenuOpen: boolean;
  onMenuOpenChange?: (_value: boolean) => void;
};

export const AppNavMobile = ({ isMenuOpen, onMenuOpenChange }: AppNavMobileProps) => {
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
        <Link to="/" onClick={handleMenuItemClick}>
          <img
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
              to={href}
              onClick={() => handleMenuItemClick()}
            >
              {_(text)}
            </Link>
          ))}

          <button
            className="text-foreground hover:text-foreground/80 text-2xl font-semibold"
            onClick={async () => authClient.signOut()}
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
