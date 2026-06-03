import { useEffect, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { useSearchParams } from 'react-router';
import { useLocation } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';

import { TeamCreateDialog } from '~/components/dialogs/team-create-dialog';
import { TeamMergeDialog } from '~/components/dialogs/team-merge-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationTeamsTable } from '~/components/tables/organisation-teams-table';

export default function OrganisationSettingsTeamsPage() {
  const { t } = useLingui();

  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set());

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

    setSearchParams(params);
  }, [debouncedSearchQuery, pathname, searchParams]);

  return (
    <div>
      <SettingsHeader title={t`Teams`} subtitle={t`Manage the teams in this organisation.`}>
        <TeamCreateDialog />
      </SettingsHeader>

      <Input
        defaultValue={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t`Search`}
        className="mb-4"
      />

      {selectedTeamIds.size >= 2 && (
        <div className="mb-4 flex items-center gap-2">
          <TeamMergeDialog
            sourceTeamIds={[...selectedTeamIds]}
            onMerged={() => setSelectedTeamIds(new Set())}
          />
          <span className="text-sm text-muted-foreground">
            {selectedTeamIds.size} <Trans>teams selected</Trans>
          </span>
        </div>
      )}

      <OrganisationTeamsTable
        selectedTeamIds={selectedTeamIds}
        onSelectionChange={setSelectedTeamIds}
      />
    </div>
  );
}
