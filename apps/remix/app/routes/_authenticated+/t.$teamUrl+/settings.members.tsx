import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { debounce, parseAsString, useQueryState } from 'nuqs';

import { TeamMemberCreateDialog } from '~/components/dialogs/team-member-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { TeamMembersTable } from '~/components/tables/team-members-table';

export default function TeamsSettingsMembersPage() {
  const { t } = useLingui();

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withDefault('').withOptions({ shallow: false, limitUrlUpdates: debounce(500) }),
  );

  return (
    <div>
      <SettingsHeader hideDivider title={t`Team Members`} subtitle={t`Manage the members of your team.`}>
        <TeamMemberCreateDialog />
      </SettingsHeader>

      <Input
        value={searchQuery}
        onChange={(e) => void setSearchQuery(e.target.value || null)}
        placeholder={t`Search`}
        className="mb-4"
      />

      <TeamMembersTable />
    </div>
  );
}
