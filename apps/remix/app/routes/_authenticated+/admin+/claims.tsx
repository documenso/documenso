import { LicenseClient } from '@documenso/lib/server-only/license/license-client';
import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { debounce, parseAsString, useQueryState } from 'nuqs';

import { ClaimCreateDialog } from '~/components/dialogs/claim-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { AdminClaimsTable } from '~/components/tables/admin-claims-table';

import type { Route } from './+types/claims';

export async function loader() {
  const licenseData = await LicenseClient.getInstance()?.getCachedLicense();

  return {
    licenseFlags: licenseData?.license?.flags,
  };
}

export default function Claims({ loaderData }: Route.ComponentProps) {
  const { licenseFlags } = loaderData;

  const { t } = useLingui();

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withDefault('').withOptions({ shallow: false, limitUrlUpdates: debounce(500) }),
  );

  return (
    <div>
      <SettingsHeader hideDivider title={t`Subscription Claims`} subtitle={t`Manage all subscription claims`}>
        <ClaimCreateDialog licenseFlags={licenseFlags} />
      </SettingsHeader>

      <div className="mt-4">
        <Input
          value={searchQuery}
          onChange={(e) => void setSearchQuery(e.target.value || null)}
          placeholder={t`Search by claim ID or name`}
          className="mb-4"
        />

        <AdminClaimsTable licenseFlags={licenseFlags} />
      </div>
    </div>
  );
}
