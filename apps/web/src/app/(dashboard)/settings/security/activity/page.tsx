import type { Metadata } from 'next';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';

import ActivityPageBackButton from '../../../../../components/(dashboard)/settings/layout/activity-back';
import { UserSecurityActivityDataTable } from './user-security-activity-data-table';

export const metadata: Metadata = {
  title: 'Security activity',
};

export default function SettingsSecurityActivityPage() {
  return (
    <div>
      <SettingsHeader
        title="Security activity"
        subtitle="View all recent security activity related to your account."
        hideDivider={true}
      >
        <ActivityPageBackButton />
      </SettingsHeader>

      <div className="mt-4">
        <UserSecurityActivityDataTable />
      </div>
    </div>
  );
}
