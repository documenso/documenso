import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { debounce, parseAsString, useQueryState } from 'nuqs';

import { EmailTransportCreateDialog } from '~/components/dialogs/email-transport-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { AdminEmailTransportsTable } from '~/components/tables/admin-email-transports-table';

export default function AdminEmailTransportsPage() {
  const { t } = useLingui();

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withDefault('').withOptions({ shallow: false, limitUrlUpdates: debounce(500) }),
  );

  return (
    <div>
      <SettingsHeader hideDivider title={t`Email Transports`} subtitle={t`Manage all email transports`}>
        <EmailTransportCreateDialog />
      </SettingsHeader>

      <div className="mt-4">
        <Input
          value={searchQuery}
          onChange={(e) => void setSearchQuery(e.target.value || null)}
          placeholder={t`Search by name or from address`}
          className="mb-4"
        />

        <AdminEmailTransportsTable />
      </div>
    </div>
  );
}
