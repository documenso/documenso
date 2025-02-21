import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { SettingsHeader } from '~/components/general/settings-header';
import { SettingsSecurityActivityTable } from '~/components/tables/settings-security-activity-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Security activity');
}

export default function SettingsSecurityActivity() {
  const { _ } = useLingui();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Security activity`)}
        subtitle={_(msg`View all security activity related to your account.`)}
        hideDivider={true}
      />

      <div className="mt-4">
        <SettingsSecurityActivityTable />
      </div>
    </div>
  );
}
