import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { ChevronsUpDown, Plus } from 'lucide-react';
import { Link } from 'react-router';

import { authClient } from '@documenso/auth/client';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { isAdmin } from '@documenso/lib/utils/is-admin';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { LanguageSwitcherDialog } from '@documenso/ui/components/common/language-switcher-dialog';
import { cn } from '@documenso/ui/lib/utils';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

export const MenuSwitcher = () => {
  const { _ } = useLingui();

  const { user } = useSession();

  const [languageSwitcherOpen, setLanguageSwitcherOpen] = useState(false);

  const isUserAdmin = isAdmin(user);

  const formatAvatarFallback = (name?: string) => {
    if (name !== undefined) {
      return name.slice(0, 1).toUpperCase();
    }

    return user.name ? extractInitials(user.name) : user.email.slice(0, 1).toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="menu-switcher"
          variant="none"
          className="relative flex h-12 flex-row items-center px-0 py-2 ring-0 focus:outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-transparent md:px-2"
        >
          <AvatarWithText
            avatarSrc={formatAvatarUrl(user.avatarImageId)}
            avatarFallback={formatAvatarFallback(user.name || user.email)}
            primaryText={user.name}
            secondaryText={_(msg`Personal Account`)}
            rightSideComponent={
              <ChevronsUpDown className="text-muted-foreground ml-auto h-4 w-4" />
            }
            textSectionClassName="hidden lg:flex"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className={cn('z-[60] ml-6 w-full min-w-[12rem] md:ml-0')}
        align="end"
        forceMount
      >
        <DropdownMenuItem className="text-muted-foreground px-4 py-2" asChild>
          <Link
            to="/settings/organisations?action=add-organisation"
            className="flex items-center justify-between"
          >
            <Trans>Create Organisation</Trans>
            <Plus className="ml-2 h-4 w-4" />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {isUserAdmin && (
          <DropdownMenuItem className="text-muted-foreground px-4 py-2" asChild>
            <Link to="/admin">
              <Trans>Admin panel</Trans>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem className="text-muted-foreground px-4 py-2" asChild>
          <Link to="/inbox">
            <Trans>Personal Inbox</Trans>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem className="text-muted-foreground px-4 py-2" asChild>
          <Link to="/settings/profile">
            <Trans>User settings</Trans>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-muted-foreground px-4 py-2"
          onClick={() => setLanguageSwitcherOpen(true)}
        >
          <Trans>Language</Trans>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-destructive/90 hover:!text-destructive px-4 py-2"
          onSelect={async () => authClient.signOut()}
        >
          <Trans>Sign Out</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <LanguageSwitcherDialog open={languageSwitcherOpen} setOpen={setLanguageSwitcherOpen} />
    </DropdownMenu>
  );
};
