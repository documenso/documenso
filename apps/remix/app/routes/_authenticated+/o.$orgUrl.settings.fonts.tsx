import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

import { FontManagementForm } from '~/components/forms/font-management-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Fonts`);
}

export default function OrganisationFontsPage() {
  const { t } = useLingui();
  const organisation = useCurrentOrganisation();

  return (
    <div className="max-w-2xl">
      <SettingsHeader title={t`Fonts`} subtitle={t`Manage fonts inherited by teams in this organisation.`} />

      <section>
        <FontManagementForm target={{ type: 'organisation', organisationId: organisation.id }} />
      </section>
    </div>
  );
}
