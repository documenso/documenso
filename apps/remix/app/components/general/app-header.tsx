import { useSession } from '@documenso/lib/client-only/providers/session';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { getRootHref } from '@documenso/lib/utils/params';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { ReadStatus } from '@prisma/client';
import { InboxIcon, MenuIcon, SearchIcon } from 'lucide-react';
import { type HTMLAttributes, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { BrandingLogo } from '~/components/general/branding-logo';

import { AppCommandMenu } from './app-command-menu';
import { AppNavDesktop } from './app-nav-desktop';
import { AppNavMobile } from './app-nav-mobile';
import { MenuSwitcher } from './menu-switcher';
import { OrgMenuSwitcher } from './org-menu-switcher';

export type HeaderProps = HTMLAttributes<HTMLDivElement>;

export const Header = ({ className, ...props }: HeaderProps) => {
  const params = useParams();

  const { organisations } = useSession();

  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const { data: unreadCountData } = trpc.document.inbox.getCount.useQuery(
    {
      readStatus: ReadStatus.NOT_OPENED,
    },
    {
      // refetchInterval: 30000, // Refetch every 30 seconds
    },
  );

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
        'sticky top-0 z-[60] flex h-16 w-full items-center border-b border-b-transparent bg-background/95 backdrop-blur duration-200 supports-backdrop-blur:bg-background/60',
        scrollY > 5 && 'border-b-border',
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-x-4 px-4 md:justify-normal md:px-8">
        <Link
          to={getRootHref(params)}
          className="hidden rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:inline"
        >
          <BrandingLogo className="h-6 w-auto" />
        </Link>

        <AppNavDesktop setIsCommandMenuOpen={setIsCommandMenuOpen} />

        <Button asChild variant="outline" className="relative hidden h-10 w-10 rounded-lg md:flex">
          <Link to="/inbox" className="relative block h-10 w-10">
            <InboxIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground" />

            {unreadCountData && unreadCountData.count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary font-semibold text-[10px] text-primary-foreground">
                {unreadCountData.count > 99 ? '99+' : unreadCountData.count}
              </span>
            )}
          </Link>
        </Button>

        <div className="md:ml-4">{isPersonalLayout(organisations) ? <MenuSwitcher /> : <OrgMenuSwitcher />}</div>

        <div className="flex flex-row items-center space-x-4 md:hidden">
          <button onClick={() => setIsCommandMenuOpen(true)}>
            <SearchIcon className="h-6 w-6 text-muted-foreground" />
          </button>

          <button onClick={() => setIsHamburgerMenuOpen(true)}>
            <MenuIcon className="h-6 w-6 text-muted-foreground" />
          </button>

          <AppCommandMenu open={isCommandMenuOpen} onOpenChange={setIsCommandMenuOpen} />

          <AppNavMobile isMenuOpen={isHamburgerMenuOpen} onMenuOpenChange={setIsHamburgerMenuOpen} />
        </div>
      </div>
    </header>
  );
};
