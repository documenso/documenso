import { useEffect, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { useLocation, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';

import { AdminOrganisationWithUserCreateDialog } from '~/components/dialogs/admin-organisation-with-user-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { AdminOrganisationsTable } from '~/components/tables/admin-organisations-table';

export default function Organisations() {
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
        hideDivider
        title={t`Manage organisations`}
        subtitle={t`Search and manage all organisations`}
      />

      <div className="mt-4">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Input
            defaultValue={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t`Search by organisation ID, name, customer ID or owner email`}
            className="flex-1"
          />
          <AdminOrganisationWithUserCreateDialog />
        </div>

        <AdminOrganisationsTable />
      </div>
    </div>
  );
}
