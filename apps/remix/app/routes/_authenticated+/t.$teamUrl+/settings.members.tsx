import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useLocation, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';

import { TeamMemberCreateDialog } from '~/components/dialogs/team-member-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { TeamMembersDataTable } from '~/components/tables/team-members-table';

export default function TeamsSettingsMembersPage() {
  const { _ } = useLingui();

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
        title={_(msg`Team Members`)}
        subtitle={_(msg`Manage the members of your team.`)}
      >
        <TeamMemberCreateDialog />
      </SettingsHeader>

      <Input
        defaultValue={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={_(msg`Search`)}
        className="mb-4"
      />

      <TeamMembersDataTable />
    </div>
  );
}
