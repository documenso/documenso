import { useLingui } from '@lingui/react/macro';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';

import { OrganisationEmailDomainCreateDialog } from '~/components/dialogs/organisation-email-domain-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationEmailDomainsDataTable } from '~/components/tables/organisation-email-domains-table';
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
        <OrganisationEmailDomainCreateDialog />
      </SettingsHeader>

      <div>
        <OrganisationEmailDomainsDataTable />
      </div>
    </div>
  );
}
