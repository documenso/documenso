import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { SettingsHeader } from '~/components/general/settings-header';
import { UserBillingOrganisationsTable } from '~/components/tables/user-billing-organisations-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Billing');
}

export default function SettingsBilling() {
  const { _ } = useLingui();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Billing`)}
        subtitle={_(
          msg`Manage billing and subscriptions for organisations where you have billing management permissions.`,
        )}
      />

      <UserBillingOrganisationsTable />
    </div>
  );
}
