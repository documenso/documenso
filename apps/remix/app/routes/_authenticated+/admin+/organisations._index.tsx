import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { debounce, parseAsString, useQueryState } from 'nuqs';

import { SettingsHeader } from '~/components/general/settings-header';
import { AdminOrganisationsTable } from '~/components/tables/admin-organisations-table';

export default function Organisations() {
  const { t } = useLingui();

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withDefault('').withOptions({ shallow: false, limitUrlUpdates: debounce(500) }),
  );

  return (
    <div>
      <SettingsHeader hideDivider title={t`Manage organisations`} subtitle={t`Search and manage all organisations`} />

      <div className="mt-4">
        <Input
          value={searchQuery}
          onChange={(e) => void setSearchQuery(e.target.value || null)}
          placeholder={t`Search by organisation ID, name, customer ID or owner email`}
          className="mb-4"
        />

        <AdminOrganisationsTable />
      </div>
    </div>
  );
}
