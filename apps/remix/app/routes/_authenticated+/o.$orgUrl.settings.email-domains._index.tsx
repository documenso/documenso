import { useLingui } from '@lingui/react/macro';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';

import { OrganisationEmailCreateDialog } from '~/components/dialogs/organisation-email-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationEmailsDataTable } from '~/components/tables/organisation-emails-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Settings');
}

export default function OrganisationSettingsGeneral() {
  const { t } = useLingui();

  const organisation = useCurrentOrganisation();

  if (!organisation.organisationClaim.flags.emailDomains) {
    return null;
  }

  return (
    <div>
      <SettingsHeader
        title={t`Email Domains`}
        subtitle={t`Here you can add email domains to your organisation.`}
      >
        <OrganisationEmailCreateDialog />
      </SettingsHeader>

      <div>
        <OrganisationEmailsDataTable />
      </div>
    </div>
  );
}
