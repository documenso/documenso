import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { SettingsHeader } from '~/components/general/settings-header';
import { SettingsSecurityActivityTable } from '~/components/tables/settings-security-activity-table';

export function meta() {
  return [{ title: 'Security activity' }];
}

export default function SettingsSecurityActivity() {
  const { _ } = useLingui();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Security activity`)}
        subtitle={_(msg`View all security activity related to your account.`)}
        hideDivider={true}
      >
        {/* Todo */}
        {/* <ActivityPageBackButton /> */}
      </SettingsHeader>

      <div className="mt-4">
        <SettingsSecurityActivityTable />
      </div>
    </div>
  );
}
