import type { SettingsNavGroups, SettingsNavItem, UnifiedSettingsScope } from '@documenso/lib/utils/settings-nav';
import { cn } from '@documenso/ui/lib/utils';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';

import { SettingsOrgSwitcher } from './settings-org-switcher';
import { SettingsSidebarMobile, SettingsSidebarMobileHeading } from './settings-sidebar-mobile';
import { SettingsTeamSwitcher } from './settings-team-switcher';

export type UnifiedSettingsSidebarMobileProps = {
  groups: SettingsNavGroups;
  activeItem: SettingsNavItem | null;
  activeScope: UnifiedSettingsScope;
  currentOrgUrl: string | null;
  currentTeamUrl: string | null;
};

export const UnifiedSettingsSidebarMobile = ({
  groups,
  activeItem,
  activeScope,
  currentOrgUrl,
  currentTeamUrl,
}: UnifiedSettingsSidebarMobileProps) => {
  const navigate = useNavigate();

  const visibleScopes = useMemo<UnifiedSettingsScope[]>(() => {
    const scopes: UnifiedSettingsScope[] = [];
    if (groups.organisation) {
      scopes.push('organisation');
    }
    if (groups.team) {
      scopes.push('team');
    }
    scopes.push('account');
    return scopes;
  }, [groups]);

  // Falls back to the Account group rather than rendering nothing — an empty scope group
  // would leave the mobile viewport with no settings navigation at all.
  const activeGroup =
    (activeScope === 'organisation' ? groups.organisation : activeScope === 'team' ? groups.team : null) ??
    groups.account;

  const handleScopeChange = (scope: UnifiedSettingsScope) => {
    if (scope === activeScope) {
      return;
    }
    if (scope === 'organisation' && groups.organisation) {
      void navigate(groups.organisation.items[0].path);
    } else if (scope === 'team' && groups.team) {
      void navigate(groups.team.items[0].path);
    } else if (scope === 'account') {
      void navigate(groups.account.items[0].path);
    }
  };

  const heading =
    visibleScopes.length > 1 ? (
      <div className="flex border-border border-b" role="tablist">
        {visibleScopes.map((scope) => {
          const isActive = scope === activeScope;
          const accent =
            scope === 'organisation'
              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300'
              : scope === 'team'
                ? 'border-blue-500 text-blue-700 dark:text-blue-300'
                : 'border-foreground text-foreground';
          return (
            <button
              key={scope}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleScopeChange(scope)}
              className={cn(
                'flex-1 border-b-2 py-2 text-center font-bold text-xs uppercase tracking-wide',
                isActive ? accent : 'border-transparent text-muted-foreground',
              )}
              data-testid={`unified-settings-mobile-tab-${scope}`}
            >
              {scope === 'organisation' && <Trans>Organisation</Trans>}
              {scope === 'team' && <Trans>Team</Trans>}
              {scope === 'account' && <Trans>Account</Trans>}
            </button>
          );
        })}
      </div>
    ) : (
      <SettingsSidebarMobileHeading>
        {activeScope === 'organisation' && <Trans>Organisation</Trans>}
        {activeScope === 'team' && <Trans>Team</Trans>}
        {activeScope === 'account' && <Trans>Account</Trans>}
      </SettingsSidebarMobileHeading>
    );

  return (
    <SettingsSidebarMobile
      data-testid="unified-settings-sidebar-mobile"
      heading={heading}
      groups={[activeGroup]}
      activeItem={activeItem}
    >
      {/* The organisation switcher is always present in a scoped view — at team scope it's
          the only way for a user who can't manage the organisation to move between them,
          since the Organisation tab is absent when they have no organisation pages. */}
      {activeScope !== 'account' && currentOrgUrl && (
        <div className="flex flex-col gap-2 px-4">
          <SettingsOrgSwitcher currentOrgUrl={currentOrgUrl} />

          {activeScope === 'team' && (
            <SettingsTeamSwitcher currentOrgUrl={currentOrgUrl} currentTeamUrl={currentTeamUrl} />
          )}
        </div>
      )}
    </SettingsSidebarMobile>
  );
};
