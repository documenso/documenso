import type { SettingsNavGroups, SettingsNavItem } from '@documenso/lib/utils/settings-nav';
import { Trans } from '@lingui/react/macro';

import { SettingsOrgSwitcher } from './settings-org-switcher';
import { SettingsSidebar, SettingsSidebarGroup } from './settings-sidebar';
import { SettingsTeamSwitcher } from './settings-team-switcher';

export type UnifiedSettingsSidebarProps = {
  groups: SettingsNavGroups;
  activeItem: SettingsNavItem | null;
  currentOrgUrl: string | null;
  currentTeamUrl: string | null;
};

export const UnifiedSettingsSidebar = ({
  groups,
  activeItem,
  currentOrgUrl,
  currentTeamUrl,
}: UnifiedSettingsSidebarProps) => {
  return (
    <SettingsSidebar data-testid="unified-settings-sidebar">
      {currentOrgUrl && (
        <SettingsSidebarGroup
          heading={<Trans>Organisation Settings</Trans>}
          switcher={<SettingsOrgSwitcher currentOrgUrl={currentOrgUrl} />}
          items={groups.organisation?.items ?? []}
          activeItem={activeItem}
          scope="organisation"
          emptyState={
            <p
              className="rounded-md border border-dashed px-3 py-2 text-muted-foreground text-xs"
              data-testid="unified-settings-organisation-empty-state"
            >
              <Trans>
                You don't have permission to manage this organisation. Switch to another one above, or continue in your
                team settings below.
              </Trans>
            </p>
          }
        />
      )}

      {groups.team && currentOrgUrl && (
        <SettingsSidebarGroup
          heading={<Trans>Team Settings</Trans>}
          switcher={<SettingsTeamSwitcher currentOrgUrl={currentOrgUrl} currentTeamUrl={currentTeamUrl} />}
          items={groups.team.items}
          activeItem={activeItem}
          scope={groups.team.scope}
        />
      )}

      <SettingsSidebarGroup
        heading={<Trans>Account Settings</Trans>}
        items={groups.account.items}
        activeItem={activeItem}
        scope={groups.account.scope}
      />
    </SettingsSidebar>
  );
};
