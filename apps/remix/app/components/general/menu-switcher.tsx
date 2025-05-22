import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import {
  Building2Icon,
  ChevronsUpDown,
  Plus,
  Settings2Icon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { authClient } from '@documenso/auth/client';
import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { EXTENDED_ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { EXTENDED_TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams-translations';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { isAdmin } from '@documenso/lib/utils/is-admin';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { canExecuteTeamAction } from '@documenso/lib/utils/teams';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { LanguageSwitcherDialog } from '@documenso/ui/components/common/language-switcher-dialog';
import { cn } from '@documenso/ui/lib/utils';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

import { useOptionalCurrentTeam } from '~/providers/team';

export const MenuSwitcher = () => {
  const { _ } = useLingui();

  const { user, organisations } = useSession();

  const { pathname } = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [languageSwitcherOpen, setLanguageSwitcherOpen] = useState(false);
  const [hoveredOrgId, setHoveredOrgId] = useState<string | null>(null);

  const isUserAdmin = isAdmin(user);

  const isPathOrgUrl = (orgUrl: string) => {
    if (!pathname || !pathname.startsWith(`/org/`)) {
      return false;
    }

    return pathname.split('/')[2] === orgUrl;
  };

  const selectedOrg = organisations.find((org) => isPathOrgUrl(org.url));
  const hoveredOrg = organisations.find(
    (org) => org.id === hoveredOrgId || organisations.length === 1,
  );

  const currentOrganisation = useOptionalCurrentOrganisation();
  const currentTeam = useOptionalCurrentTeam();

  // Use hovered org for teams display if available,
  // otherwise use current team's org if in a team,
  // finally fallback to selected org
  const displayedOrg = hoveredOrg || currentOrganisation || selectedOrg;

  const formatAvatarFallback = (name?: string) => {
    if (name !== undefined) {
      return name.slice(0, 1).toUpperCase();
    }

    return user.name ? extractInitials(user.name) : user.email.slice(0, 1).toUpperCase();
  };

  /**
   * Formats the redirect URL so we can switch between documents and templates page
   * seemlessly between organisations and personal accounts.
   */
  const formatRedirectUrlOnSwitch = (orgUrl?: string) => {
    const baseUrl = orgUrl ? `/org/${orgUrl}` : '';

    const currentPathname = (pathname ?? '/').replace(/^\/org\/[^/]+/, '');

    if (currentPathname === '/templates') {
      return `${baseUrl}/templates`;
    }

    return baseUrl;
  };

  const dropdownMenuAvatarText = useMemo(() => {
    if (currentTeam) {
      return {
        avatarSrc: formatAvatarUrl(currentTeam.avatarImageId),
        avatarFallback: formatAvatarFallback(currentTeam.name),
        primaryText: currentTeam.name,
        secondaryText: _(EXTENDED_TEAM_MEMBER_ROLE_MAP[currentTeam.currentTeamRole]),
      };
    }

    if (currentOrganisation) {
      return {
        avatarSrc: formatAvatarUrl(currentOrganisation.avatarImageId),
        avatarFallback: formatAvatarFallback(currentOrganisation.name),
        primaryText: currentOrganisation.name,
        secondaryText: _(
          EXTENDED_ORGANISATION_MEMBER_ROLE_MAP[currentOrganisation.currentOrganisationRole],
        ),
      };
    }

    return {
      avatarSrc: formatAvatarUrl(user.avatarImageId),
      avatarFallback: formatAvatarFallback(user.name ?? user.email),
      primaryText: user.name,
      secondaryText: _(msg`Personal Account`),
    };
  }, [currentTeam, currentOrganisation, user]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setHoveredOrgId(currentOrganisation?.id || null);
    }

    setIsOpen(open);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="menu-switcher"
          variant="none"
          className="relative flex h-12 flex-row items-center px-0 py-2 ring-0 focus:outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-transparent md:px-2"
        >
          <AvatarWithText
            avatarSrc={dropdownMenuAvatarText.avatarSrc}
            avatarFallback={dropdownMenuAvatarText.avatarFallback}
            primaryText={dropdownMenuAvatarText.primaryText}
            secondaryText={dropdownMenuAvatarText.secondaryText}
            rightSideComponent={
              <ChevronsUpDown className="text-muted-foreground ml-auto h-4 w-4" />
            }
            textSectionClassName="hidden lg:flex"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className={cn('divide-border z-[60] ml-6 flex w-full min-w-[40rem] divide-x p-0 md:ml-0')}
        align="end"
        forceMount
      >
        <div className="flex h-[400px] w-full divide-x">
          {/* Organisations column */}
          <div className="flex w-1/3 flex-col">
            <div className="flex h-12 items-center border-b p-2">
              <h3 className="text-muted-foreground flex items-center px-2 text-sm font-medium">
                <Building2Icon className="mr-2 h-3.5 w-3.5" />
                <Trans>Organisations</Trans>
              </h3>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-1.5">
              {organisations.map((org) => (
                <div
                  className="group relative"
                  key={org.id}
                  onMouseEnter={() => setHoveredOrgId(org.id)}
                >
                  <DropdownMenuItem
                    className={cn(
                      'text-muted-foreground w-full px-4 py-2',
                      org.id === currentOrganisation?.id && !hoveredOrgId && 'bg-accent',
                      org.id === hoveredOrgId && 'bg-accent',
                    )}
                    asChild
                  >
                    <Link to={`/org/${org.url}`} className="flex items-center space-x-2 pr-8">
                      <span
                        className={cn('min-w-0 flex-1 truncate', {
                          'font-semibold': org.id === selectedOrg?.id,
                        })}
                      >
                        {org.name}
                      </span>
                    </Link>
                  </DropdownMenuItem>

                  {canExecuteOrganisationAction(
                    'MANAGE_ORGANISATION',
                    org.currentOrganisationRole,
                  ) && (
                    <div className="absolute bottom-0 right-0 top-0 flex items-center justify-center">
                      <Link
                        to={`/org/${org.url}/settings`}
                        className="text-muted-foreground mr-2 rounded-sm border p-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                      >
                        <Settings2Icon className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              ))}

              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link to="/settings/organisations?action=add-organisation">
                  <Plus className="mr-2 h-4 w-4" />
                  <Trans>Create Organisation</Trans>
                </Link>
              </Button>
            </div>
          </div>

          {/* Teams column */}
          <div className="flex w-1/3 flex-col">
            <div className="flex h-12 items-center border-b p-2">
              <h3 className="text-muted-foreground flex items-center px-2 text-sm font-medium">
                <UsersIcon className="mr-2 h-3.5 w-3.5" />
                <Trans>Teams</Trans>
              </h3>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-1.5">
              <AnimateGenericFadeInOut key={displayedOrg ? 'displayed-org' : 'no-org'}>
                {hoveredOrg ? (
                  hoveredOrg.teams.map((team) => (
                    <div className="group relative" key={team.id}>
                      <DropdownMenuItem
                        className={cn(
                          'text-muted-foreground w-full px-4 py-2',
                          team.id === currentTeam?.id && 'bg-accent',
                        )}
                        asChild
                      >
                        <Link to={`/t/${team.url}`} className="flex items-center space-x-2 pr-8">
                          <span
                            className={cn('min-w-0 flex-1 truncate', {
                              'font-semibold': team.id === currentTeam?.id,
                            })}
                          >
                            {team.name}
                          </span>
                        </Link>
                      </DropdownMenuItem>

                      {canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole) && (
                        <div className="absolute bottom-0 right-0 top-0 flex items-center justify-center">
                          <Link
                            to={`/t/${team.url}/settings`}
                            className="text-muted-foreground mr-2 rounded-sm border p-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                          >
                            <Settings2Icon className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground my-12 flex items-center justify-center px-2 text-center text-sm">
                    <Trans>Select an organisation to view teams</Trans>
                  </div>
                )}

                {displayedOrg && (
                  <Button variant="ghost" className="w-full justify-start" asChild>
                    <Link to={`/org/${displayedOrg.url}/settings/teams?action=add-team`}>
                      <Plus className="mr-2 h-4 w-4" />
                      <Trans>Create Team</Trans>
                    </Link>
                  </Button>
                )}
              </AnimateGenericFadeInOut>
            </div>
          </div>

          {/* Settings column */}
          <div className="flex w-1/3 flex-col">
            <div className="flex h-12 items-center border-b p-2">
              <h3 className="text-muted-foreground flex items-center px-2 text-sm font-medium">
                <SettingsIcon className="mr-2 h-3.5 w-3.5" />
                <Trans>Settings</Trans>
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
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
                  <Trans>Account</Trans>
                </Link>
              </DropdownMenuItem>

              {currentOrganisation &&
                canExecuteOrganisationAction(
                  'MANAGE_ORGANISATION',
                  currentOrganisation.currentOrganisationRole,
                ) && (
                  <DropdownMenuItem className="text-muted-foreground px-4 py-2" asChild>
                    <Link to={`/org/${currentOrganisation.url}/settings`}>
                      <Trans>Organisation settings</Trans>
                    </Link>
                  </DropdownMenuItem>
                )}

              {currentTeam && canExecuteTeamAction('MANAGE_TEAM', currentTeam.currentTeamRole) && (
                <DropdownMenuItem className="text-muted-foreground px-4 py-2" asChild>
                  <Link to={`/t/${currentTeam.url}/settings`}>
                    <Trans>Team settings</Trans>
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                className="text-muted-foreground px-4 py-2"
                onClick={() => setLanguageSwitcherOpen(true)}
              >
                <Trans>Language</Trans>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="text-muted-foreground hover:!text-muted-foreground px-4 py-2"
                onSelect={async () => authClient.signOut()}
              >
                <Trans>Sign Out</Trans>
              </DropdownMenuItem>
            </div>
          </div>
        </div>
      </DropdownMenuContent>

      <LanguageSwitcherDialog open={languageSwitcherOpen} setOpen={setLanguageSwitcherOpen} />
    </DropdownMenu>
  );
};
