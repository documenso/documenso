import type { SettingsNavGroups, SettingsNavScope } from '@documenso/lib/utils/settings-nav';
import { cn } from '@documenso/ui/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { SettingsOrgSwitcher } from './settings-org-switcher';
import { SettingsTeamSwitcher } from './settings-team-switcher';

type MobileScope = SettingsNavScope | 'account';

export type UnifiedSettingsSidebarMobileProps = {
  groups: SettingsNavGroups;
  activeScope: MobileScope;
  currentOrgUrl: string | null;
  currentTeamUrl: string | null;
};

export const UnifiedSettingsSidebarMobile = ({
  groups,
  activeScope,
  currentOrgUrl,
  currentTeamUrl,
}: UnifiedSettingsSidebarMobileProps) => {
  const { _ } = useLingui();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const visibleScopes = useMemo<MobileScope[]>(() => {
    const scopes: MobileScope[] = [];
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

  const selectableItems = useMemo(() => activeGroup.items.filter((item) => !item.isSubNavParent), [activeGroup.items]);

  // The select matches on exact value, but plenty of settings pages are sub-routes of a
  // nav item (`/settings/security/passkeys`, `/t/x/settings/webhooks/:id`, …). Resolving
  // to the longest matching item path keeps the trigger populated on those pages instead
  // of rendering an empty box — mirrors the desktop sidebar's prefix highlighting.
  const selectedPath = useMemo(() => {
    let bestMatch: string | undefined;

    for (const item of selectableItems) {
      if (pathname !== item.path && !pathname.startsWith(`${item.path}/`)) {
        continue;
      }

      if (!bestMatch || item.path.length > bestMatch.length) {
        bestMatch = item.path;
      }
    }

    return bestMatch;
  }, [selectableItems, pathname]);

  const handleScopeChange = (scope: MobileScope) => {
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

  // The tab row stays full-bleed (its border-b acts as a full-width divider); the
  // sections under it get `px-4` to line up with the content pane's own `px-4`
  // inset, and `pb-4` keeps the last control off the aside's bottom border.
  return (
    <div className="flex flex-col gap-3 pb-4" data-testid="unified-settings-sidebar-mobile">
      {visibleScopes.length > 1 ? (
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
        <div className="px-4 py-2 text-center font-bold text-muted-foreground text-xs uppercase tracking-wide">
          {activeScope === 'organisation' && <Trans>Organisation</Trans>}
          {activeScope === 'team' && <Trans>Team</Trans>}
          {activeScope === 'account' && <Trans>Account</Trans>}
        </div>
      )}

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

      <div className="px-4">
        <div className="mb-1 font-bold text-[10px] text-muted-foreground uppercase tracking-wide">
          <Trans>Jump to</Trans>
        </div>
        <Select
          value={selectedPath}
          onValueChange={(value) => {
            void navigate(value);
          }}
        >
          <SelectTrigger data-testid="unified-settings-mobile-section-trigger">
            <SelectValue placeholder={_(msg`Select a section`)} />
          </SelectTrigger>
          <SelectContent>
            {selectableItems.map((item) => (
              <SelectItem key={item.path} value={item.path}>
                {item.isSubNav ? `${_(msg`Preferences`)} › ${_(item.label)}` : _(item.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
