import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { SessionLogoutAllDialog } from '~/components/dialogs/session-logout-all-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { SettingsSecuritySessionTable } from '~/components/tables/settings-security-session-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Active sessions');
}

export default function SettingsSecuritySessions() {
  const { _ } = useLingui();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Active sessions`)}
        subtitle={_(msg`View and manage all active sessions for your account.`)}
        hideDivider={true}
      >
        <SessionLogoutAllDialog />
      </SettingsHeader>

      <div className="mt-4">
        <SettingsSecuritySessionTable />
      </div>
    </div>
  );
}
