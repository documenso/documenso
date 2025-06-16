import { useEffect, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';
import { useLocation, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { trpc } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { Input } from '@documenso/ui/primitives/input';

import { TeamGroupCreateDialog } from '~/components/dialogs/team-group-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { TeamInheritMemberAlert } from '~/components/general/teams/team-inherit-member-alert';
import { TeamGroupsTable } from '~/components/tables/team-groups-table';
import { useCurrentTeam } from '~/providers/team';

export default function TeamsSettingsGroupsPage() {
  const { t } = useLingui();

  const [searchParams, setSearchParams] = useSearchParams();

  const { pathname } = useLocation();
  const team = useCurrentTeam();

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

  const everyoneGroupQuery = trpc.team.group.find.useQuery({
    teamId: team.id,
    types: [OrganisationGroupType.INTERNAL_ORGANISATION],
    organisationRoles: [OrganisationMemberRole.MEMBER],
    perPage: 1,
  });

  const memberAccessTeamGroup = everyoneGroupQuery.data?.data[0] || null;

  return (
    <div>
      <SettingsHeader title={t`Team Groups`} subtitle={t`Manage the groups assigned to this team.`}>
        <TeamGroupCreateDialog />
      </SettingsHeader>

      <Input
        defaultValue={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t`Search`}
        className="mb-4"
      />

      <TeamGroupsTable />

      <AnimateGenericFadeInOut key={everyoneGroupQuery.isFetched ? 'true' : 'false'}>
        {everyoneGroupQuery.isFetched && (
          <TeamInheritMemberAlert memberAccessTeamGroup={memberAccessTeamGroup} />
        )}
      </AnimateGenericFadeInOut>
    </div>
  );
}
