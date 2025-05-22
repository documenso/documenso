import { useLingui } from '@lingui/react/macro';

import { OrganisationGroupCreateDialog } from '~/components/dialogs/organisation-group-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationGroupsDataTable } from '~/components/tables/organisation-groups-table';

export default function TeamsSettingsMembersPage() {
  const { t } = useLingui();

  return (
    <div>
      <SettingsHeader
        title={t`Custom Organisation Groups`}
        subtitle={t`Manage the custom groups of members for your organisation.`}
      >
        <OrganisationGroupCreateDialog />
      </SettingsHeader>

      <div>
        <OrganisationGroupsDataTable />
      </div>
    </div>
  );
}
