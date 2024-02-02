import type { Metadata } from 'next';

import { UserSecurityActivityDataTable } from './user-security-activity-data-table';

export const metadata: Metadata = {
  title: 'Security activity',
};

export default function SettingsSecurityActivityPage() {
  return (
    <div>
      <h3 className="text-2xl font-semibold">Security activity</h3>

      <p className="text-muted-foreground mt-2 text-sm">
        View all recent security activity related to your account.
      </p>

      <hr className="my-4" />

      <UserSecurityActivityDataTable />
    </div>
  );
}
