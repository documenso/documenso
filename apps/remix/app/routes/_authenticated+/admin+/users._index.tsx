import { Trans } from '@lingui/react/macro';

import { AdminUserCreateDialog } from '~/components/dialogs/admin-user-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { AdminDashboardUsersTable } from '~/components/tables/admin-dashboard-users-table';

export default function AdminManageUsersPage() {
  return (
    <div>
      <SettingsHeader
        hideDivider
        title={<Trans>Manage users</Trans>}
        subtitle={<Trans>Search and manage all users</Trans>}
      >
        <AdminUserCreateDialog />
      </SettingsHeader>

      <AdminDashboardUsersTable />
    </div>
  );
}
