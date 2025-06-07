import type { HTMLAttributes } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { useOptionalCurrentTeam } from '~/providers/team';

export type AppNavDesktopProps = HTMLAttributes<HTMLDivElement> & {
  setIsCommandMenuOpen: (value: boolean) => void;
};

export const AppNavDesktop = ({
  className,
  setIsCommandMenuOpen,
  ...props
}: AppNavDesktopProps) => {
  const { _ } = useLingui();
  const { organisations } = useSession();

  const { pathname } = useLocation();

  const [modifierKey, setModifierKey] = useState(() => 'Ctrl');

  const currentTeam = useOptionalCurrentTeam();

  useEffect(() => {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const isMacOS = /Macintosh|Mac\s+OS\s+X/i.test(userAgent);

    setModifierKey(isMacOS ? '⌘' : 'Ctrl');
  }, []);

  const menuNavigationLinks = useMemo(() => {
    let teamUrl = currentTeam?.url || null;

    if (!teamUrl && isPersonalLayout(organisations)) {
      teamUrl = organisations[0].teams[0]?.url || null;
    }

    if (!teamUrl) {
      return [];
    }

    return [
      {
        href: `/t/${teamUrl}/documents`,
        label: msg`Documents`,
      },
      {
        href: `/t/${teamUrl}/templates`,
        label: msg`Templates`,
      },
    ];
  }, [currentTeam, organisations]);

  return (
    <div
      className={cn(
        'ml-8 hidden flex-1 items-center gap-x-12 md:flex md:justify-between',
        className,
      )}
      {...props}
    >
      <div>
        <AnimatePresence>
          {menuNavigationLinks.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-baseline gap-x-6"
            >
              {menuNavigationLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  to={href}
                  className={cn(
                    'text-muted-foreground dark:text-muted-foreground/60 focus-visible:ring-ring ring-offset-background rounded-md font-medium leading-5 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2',
                    {
                      'text-foreground dark:text-muted-foreground': pathname?.startsWith(href),
                    },
                  )}
                >
                  {_(label)}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Button
        variant="outline"
        className="text-muted-foreground flex w-full max-w-96 items-center justify-between rounded-lg"
        onClick={() => setIsCommandMenuOpen(true)}
      >
        <div className="flex items-center">
          <Search className="mr-2 h-5 w-5" />
          <Trans>Search</Trans>
        </div>

        <div>
          <div className="text-muted-foreground bg-muted flex items-center rounded-md px-1.5 py-0.5 text-xs tracking-wider">
            {modifierKey}+K
          </div>
        </div>
      </Button>
    </div>
  );
};
