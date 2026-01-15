import { useEffect, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { useLocation, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { LicenseClient } from '@documenso/lib/server-only/license/license-client';
import { Input } from '@documenso/ui/primitives/input';

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

  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  /**
   * Handle debouncing the search query.
   */
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString());

    params.set('query', debouncedSearchQuery);

    if (debouncedSearchQuery === '') {
      params.delete('query');
    }

    // If nothing  to change then do nothing.
    if (params.toString() === searchParams?.toString()) {
      return;
    }

    setSearchParams(params);
  }, [debouncedSearchQuery, pathname, searchParams]);

  return (
    <div>
      <SettingsHeader
        title={t`Subscription Claims`}
        subtitle={t`Manage all subscription claims`}
        hideDivider
      >
        <ClaimCreateDialog licenseFlags={licenseFlags} />
      </SettingsHeader>

      <div className="mt-4">
        <Input
          defaultValue={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t`Search by claim ID or name`}
          className="mb-4"
        />

        <AdminClaimsTable licenseFlags={licenseFlags} />
      </div>
    </div>
  );
}
