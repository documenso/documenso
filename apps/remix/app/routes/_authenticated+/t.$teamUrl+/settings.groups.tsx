import { trpc } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';
import { debounce, parseAsString, useQueryState } from 'nuqs';

import { TeamGroupCreateDialog } from '~/components/dialogs/team-group-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { TeamInheritMemberAlert } from '~/components/general/teams/team-inherit-member-alert';
import { TeamGroupsTable } from '~/components/tables/team-groups-table';
import { useCurrentTeam } from '~/providers/team';

export default function TeamsSettingsGroupsPage() {
  const { t } = useLingui();

  const team = useCurrentTeam();

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withDefault('').withOptions({ shallow: false, limitUrlUpdates: debounce(500) }),
  );

  const everyoneGroupQuery = trpc.team.group.find.useQuery({
    teamId: team.id,
    types: [OrganisationGroupType.INTERNAL_ORGANISATION],
    organisationRoles: [OrganisationMemberRole.MEMBER],
    perPage: 1,
  });

  const memberAccessTeamGroup = everyoneGroupQuery.data?.data[0] || null;

  return (
    <div>
      <SettingsHeader hideDivider title={t`Team Groups`} subtitle={t`Manage the groups assigned to this team.`}>
        <TeamGroupCreateDialog />
      </SettingsHeader>

      <Input
        value={searchQuery}
        onChange={(e) => void setSearchQuery(e.target.value || null)}
        placeholder={t`Search`}
        className="mb-4"
      />

      <TeamGroupsTable />

      <AnimateGenericFadeInOut key={everyoneGroupQuery.isFetched ? 'true' : 'false'}>
        {everyoneGroupQuery.isFetched && <TeamInheritMemberAlert memberAccessTeamGroup={memberAccessTeamGroup} />}
      </AnimateGenericFadeInOut>
    </div>
  );
}
