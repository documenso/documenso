import { useLingui } from '@lingui/react/macro';

import { SettingsHeader } from '~/components/general/settings-header';
import { UserBillingOrganisationsTable } from '~/components/tables/user-billing-organisations-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Billing');
}

export default function SettingsBilling() {
  const { t } = useLingui();

  return (
    <div>
      <SettingsHeader
        title={t`Billing`}
        subtitle={t`Manage billing and subscriptions for organisations where you have billing management permissions.`}
      />

      <UserBillingOrganisationsTable />
    </div>
  );
}
