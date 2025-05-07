import { useEffect, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { Link, useSearchParams } from 'react-router';
import { useLocation } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { trpc } from '@documenso/trpc/react';
import { Input } from '@documenso/ui/primitives/input';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { TeamCreateDialog } from '~/components/dialogs/team-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationPendingTeamsTable } from '~/components/tables/organisation-pending-teams-table';
import { OrganisationTeamsTable } from '~/components/tables/organisation-teams-table';

export default function OrganisationSettingsTeamsPage() {
  const { t } = useLingui();

  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  const currentTab = searchParams?.get('tab') === 'pending' ? 'pending' : 'active';

  const { data } = trpc.team.findTeamsPending.useQuery(
    {},
    {
      placeholderData: (previousData) => previousData,
    },
  );

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

      <div>
        <div className="my-4 flex flex-row items-center justify-between space-x-4">
          <Input
            defaultValue={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t`Search`}
          />

          <Tabs value={currentTab} className="flex-shrink-0 overflow-x-auto">
            <TabsList>
              <TabsTrigger className="min-w-[60px]" value="active" asChild>
                <Link to={pathname ?? '/'}>
                  <Trans>Active</Trans>
                </Link>
              </TabsTrigger>

              <TabsTrigger className="min-w-[60px]" value="pending" asChild>
                <Link to={`${pathname}?tab=pending`}>
                  <Trans>Pending</Trans>
                  {data && data.count > 0 && (
                    <span className="ml-1 hidden opacity-50 md:inline-block">{data.count}</span>
                  )}
                </Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {currentTab === 'pending' ? <OrganisationPendingTeamsTable /> : <OrganisationTeamsTable />}
      </div>
    </div>
  );
}
