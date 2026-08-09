import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { getSettingsNavGroups, type SettingsNavGroup, type SettingsNavItem } from '@documenso/lib/utils/settings-nav';
import { canExecuteTeamAction } from '@documenso/lib/utils/teams';
import { Button } from '@documenso/ui/primitives/button';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { match } from 'ts-pattern';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { useOptionalCurrentTeam } from '~/providers/team';
import { SettingsScopeBreadcrumb } from './settings-scope-breadcrumb';
import { UnifiedSettingsSidebar } from './unified-settings-sidebar';
import { UnifiedSettingsSidebarMobile } from './unified-settings-sidebar-mobile';

export type UnifiedSettingsScope = 'organisation' | 'team' | 'account';

export type UnifiedSettingsLayoutProps = {
  activeScope: UnifiedSettingsScope;

  /**
   * The team the user last worked in, read from the `preferred-team-url` cookie by the
   * layout's loader. Used to keep the sidebar's team switcher stable at organisation and
   * account scope, where the URL carries no team.
   */
  preferredTeamUrl?: string | null;
};

/**
 * Walk a group's items and find the item (and its parent if it's a sub-nav child)
 * that matches the current pathname most specifically. Returns the labels to use
 * as breadcrumb crumbs (e.g. ['Preferences', 'Document'] or just ['Members']).
 */
const findActiveCrumbs = (group: SettingsNavGroup | null, pathname: string): MessageDescriptor[] => {
  if (!group) {
    return [];
  }

  let bestMatch: SettingsNavItem | null = null;

  for (const item of group.items) {
    if (item.isSubNavParent) {
      continue;
    }

    if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
      if (!bestMatch || item.path.length > bestMatch.path.length) {
        bestMatch = item;
      }
    }
  }

  if (!bestMatch) {
    return [];
  }

  if (bestMatch.isSubNav) {
    const parent = group.items.find((it) => it.isSubNavParent);
    return parent ? [parent.label, bestMatch.label] : [bestMatch.label];
  }

  return [bestMatch.label];
};

export const UnifiedSettingsLayout = ({ activeScope, preferredTeamUrl = null }: UnifiedSettingsLayoutProps) => {
  const { _ } = useLingui();
  const { organisations } = useSession();
  const { pathname } = useLocation();

  const currentOrganisation = useOptionalCurrentOrganisation();
  const team = useOptionalCurrentTeam();

  const contentPaneRef = useRef<HTMLElement>(null);

  // Scroll back to the top when navigating between settings pages.
  useEffect(() => {
    contentPaneRef.current?.scrollTo(0, 0);
  }, [pathname]);

  // An organisation is worth showing in the sidebar if it has settings the user can reach —
  // either the organisation's own, or those of a team inside it.
  const hasReachableSettings = (org: (typeof organisations)[number]) =>
    canExecuteOrganisationAction('MANAGE_ORGANISATION', org.currentOrganisationRole) ||
    org.teams.some((t) => canExecuteTeamAction('MANAGE_TEAM', t.currentTeamRole));

  const organisation =
    currentOrganisation ??
    organisations.find((org) => org.teams.some((t) => t.url === preferredTeamUrl) && hasReachableSettings(org)) ??
    organisations.find(hasReachableSettings) ??
    null;

  const manageableTeams = organisation?.teams.filter((t) => canExecuteTeamAction('MANAGE_TEAM', t.currentTeamRole));

  const teamForSidebar =
    team ?? manageableTeams?.find((t) => t.url === preferredTeamUrl) ?? manageableTeams?.[0] ?? null;

  const sidebarTeamUrl = teamForSidebar?.url ?? null;

  // Sync the selected team URL in the sidebar into the preferred team URL cookie.
  useEffect(() => {
    if (!sidebarTeamUrl) {
      return;
    }

    const body = new FormData();

    body.append('teamUrl', sidebarTeamUrl);

    void fetch('/api/preferred-team', { method: 'POST', body });
  }, [sidebarTeamUrl]);

  const groups = getSettingsNavGroups({
    organisation: organisation
      ? {
          url: organisation.url,
          currentOrganisationRole: organisation.currentOrganisationRole,
          organisationClaim: organisation.organisationClaim,
        }
      : null,
    team: teamForSidebar ? { url: teamForSidebar.url, currentTeamRole: teamForSidebar.currentTeamRole } : null,
    hasManageableBillingOrgs: organisations.some((org) =>
      canExecuteOrganisationAction('MANAGE_BILLING', org.currentOrganisationRole),
    ),
  });

  const canManageOrg =
    organisation !== null && canExecuteOrganisationAction('MANAGE_ORGANISATION', organisation.currentOrganisationRole);

  // Must be derived from the team in the URL context, NOT from `teamForSidebar` — the
  // latter falls back to any manageable team in the org, which would let a team manager
  // through the organisation-scope guard (and `useOptionalCurrentTeam()` resolves for any
  // member regardless of role, which would let a plain member through the team guard).
  const canManageCurrentTeam = team !== null && canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole);

  // Account pages are available to every user. The organisation and team scopes each
  // require the manage permission for THAT scope — they are not interchangeable.
  const isAuthorised = match(activeScope)
    .with('account', () => true)
    .with('organisation', () => canManageOrg)
    .with('team', () => canManageCurrentTeam)
    .exhaustive();

  if (!isAuthorised) {
    return (
      <GenericErrorLayout
        errorCode={401}
        errorCodeMap={{
          401: {
            heading: msg`Unauthorized`,
            subHeading: msg`401 Unauthorized`,
            message: msg`You are not authorized to access this page.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to="/settings">
              <Trans>Go to your settings</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  const scopeName = match(activeScope)
    .with('account', () => _(msg`Account`))
    .with('organisation', () => organisation?.name ?? '')
    .with('team', () => team?.name ?? organisation?.name ?? '')
    .exhaustive();

  const activeGroup =
    activeScope === 'account' ? groups.account : activeScope === 'organisation' ? groups.organisation : groups.team;

  const crumbs = findActiveCrumbs(activeGroup, pathname).map((label) => _(label));

  return (
    <div className="flex flex-col md:min-h-0 md:flex-1 md:flex-row">
      <aside className="hover-scrollbar w-full shrink-0 border-b bg-background md:w-80 md:overflow-y-auto md:border-r md:border-b-0">
        <div className="flex h-full flex-col">
          <div className="hidden md:block">
            <UnifiedSettingsSidebar
              groups={groups}
              currentOrgUrl={organisation?.url ?? null}
              currentTeamUrl={teamForSidebar?.url ?? null}
            />
          </div>
          <div className="md:hidden">
            <UnifiedSettingsSidebarMobile
              groups={groups}
              activeScope={activeScope}
              currentOrgUrl={organisation?.url ?? null}
              currentTeamUrl={teamForSidebar?.url ?? null}
            />
          </div>
        </div>
      </aside>

      <main ref={contentPaneRef} className="relative flex-1 px-4 md:overflow-y-auto md:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-3xl py-6 md:py-8" data-testid="unified-settings-content">
          <SettingsScopeBreadcrumb scope={activeScope} scopeName={scopeName} crumbs={crumbs} />
          <Outlet />
        </div>
      </main>
    </div>
  );
};
