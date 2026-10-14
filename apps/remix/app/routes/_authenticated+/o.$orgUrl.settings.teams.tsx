import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { debounce, parseAsString, useQueryState } from 'nuqs';

import { TeamCreateDialog } from '~/components/dialogs/team-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationTeamsTable } from '~/components/tables/organisation-teams-table';

export default function OrganisationSettingsTeamsPage() {
  const { t } = useLingui();

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withDefault('').withOptions({ shallow: false, limitUrlUpdates: debounce(500) }),
  );

  return (
    <div>
      <SettingsHeader hideDivider title={t`Teams`} subtitle={t`Manage the teams in this organisation.`}>
        <TeamCreateDialog />
      </SettingsHeader>

      <Input
        value={searchQuery}
        onChange={(e) => void setSearchQuery(e.target.value || null)}
        placeholder={t`Search`}
        className="mb-4"
      />

      <OrganisationTeamsTable />
    </div>
  );
}
