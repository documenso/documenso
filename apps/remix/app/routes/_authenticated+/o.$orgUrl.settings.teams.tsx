import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { TeamCreateDialog } from '~/components/dialogs/team-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationTeamsTable } from '~/components/tables/organisation-teams-table';

export default function OrganisationSettingsTeamsPage() {
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

    // A new query can shrink the result set below the current page, and the
    // pagination unmounts on a single page of results -- leaving the user on
    // an empty table with no way back. Always return to the first page (#3199).
    params.delete('page');

    setSearchParams(params);
  }, [debouncedSearchQuery, pathname, searchParams]);

  return (
    <div>
      <SettingsHeader hideDivider title={t`Teams`} subtitle={t`Manage the teams in this organisation.`}>
        <TeamCreateDialog />
      </SettingsHeader>

      <Input
        defaultValue={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t`Search`}
        className="mb-4"
      />

      <OrganisationTeamsTable />
    </div>
  );
}
