import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { OrganisationCreateDialog } from '~/components/dialogs/organisation-create-dialog';
import { OrganisationInvitations } from '~/components/general/organisations/organisation-invitations';
import { SettingsHeader } from '~/components/general/settings-header';
import { UserOrganisationsTable } from '~/components/tables/user-organisations-table';

export default function TeamsSettingsPage() {
  const { _ } = useLingui();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Organisations`)}
        subtitle={_(msg`Manage all organisations you are currently associated with.`)}
      >
        <OrganisationCreateDialog />
      </SettingsHeader>

      <UserOrganisationsTable />

      <div className="mt-8 space-y-8">
        <OrganisationInvitations />
      </div>
    </div>
  );
}
