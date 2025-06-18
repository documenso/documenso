import { useMemo } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { ReadStatus } from '@prisma/client';
import { Link } from 'react-router';

import LogoImage from '@documenso/assets/logo.png';
import { authClient } from '@documenso/auth/client';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { Sheet, SheetContent } from '@documenso/ui/primitives/sheet';
import { ThemeSwitcher } from '@documenso/ui/primitives/theme-switcher';

import { useOptionalCurrentTeam } from '~/providers/team';

export type AppNavMobileProps = {
  isMenuOpen: boolean;
  onMenuOpenChange?: (_value: boolean) => void;
};

export const AppNavMobile = ({ isMenuOpen, onMenuOpenChange }: AppNavMobileProps) => {
  const { t } = useLingui();

  const { organisations } = useSession();

  const currentTeam = useOptionalCurrentTeam();

  const { data: unreadCountData } = trpc.document.inbox.getCount.useQuery(
    {
      readStatus: ReadStatus.NOT_OPENED,
    },
    {
      // refetchInterval: 30000, // Refetch every 30 seconds
    },
  );

  const handleMenuItemClick = () => {
    onMenuOpenChange?.(false);
  };

  const menuNavigationLinks = useMemo(() => {
    let teamUrl = currentTeam?.url || null;

    if (!teamUrl && isPersonalLayout(organisations)) {
      teamUrl = organisations[0].teams[0]?.url || null;
    }

    if (!teamUrl) {
      return [
        {
          href: '/inbox',
          text: t`Inbox`,
        },
        {
          href: '/settings/profile',
          text: t`Settings`,
        },
      ];
    }

    return [
      {
        href: `/t/${teamUrl}/documents`,
        text: t`Documents`,
      },
      {
        href: `/t/${teamUrl}/templates`,
        text: t`Templates`,
      },
      {
        href: '/inbox',
        text: t`Inbox`,
      },
      {
        href: '/settings/profile',
        text: t`Settings`,
      },
    ];
  }, [currentTeam, organisations]);

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
              className="text-foreground hover:text-foreground/80 flex items-center gap-2 text-2xl font-semibold"
              to={href}
              onClick={() => handleMenuItemClick()}
            >
              {text}
              {href === '/inbox' && unreadCountData && unreadCountData.count > 0 && (
                <span className="bg-primary text-primary-foreground flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold">
                  {unreadCountData.count > 99 ? '99+' : unreadCountData.count}
                </span>
              )}
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
