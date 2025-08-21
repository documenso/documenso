import { useCallback, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { useLocation, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';

import { TeamMemberCreateDialog } from '~/components/dialogs/team-member-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { TeamMembersTable } from '~/components/tables/team-members-table';

export default function TeamsSettingsMembersPage() {
  const { t } = useLingui();

  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);
  /**
   * Handle debouncing the search query.
   */
  const handleSearchQueryChange = useCallback(
    (newQuery: string) => {
      const params = new URLSearchParams(searchParams?.toString());

      if (newQuery.trim()) {
        params.set('query', newQuery);
      } else {
        params.delete('query');
      }

      // If nothing to change then do nothing.
      if (params.toString() === searchParams?.toString()) {
        return;
      }

      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const currentParamQuery = searchParams?.get('query') ?? '';
  if (currentParamQuery !== debouncedSearchQuery) {
    handleSearchQueryChange(debouncedSearchQuery);
  }

  return (
    <div>
      <SettingsHeader title={t`Team Members`} subtitle={t`Manage the members of your team.`}>
        <TeamMemberCreateDialog />
      </SettingsHeader>

      <Input
        defaultValue={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t`Search`}
        className="mb-4"
      />

      <TeamMembersTable />
    </div>
  );
}
