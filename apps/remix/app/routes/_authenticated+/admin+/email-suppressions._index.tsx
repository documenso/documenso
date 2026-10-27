import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { useQueryStates } from 'nuqs';

import { EmailSuppressionCreateDialog } from '~/components/dialogs/email-suppression-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { AdminEmailSuppressionsTable } from '~/components/tables/admin-email-suppressions-table';
import { adminEmailSuppressionsSearchParams } from '~/utils/admin-email-suppressions-search-params';

export default function AdminEmailSuppressionsPage() {
  const { t } = useLingui();

  const [{ query }, setSearchParams] = useQueryStates({
    query: adminEmailSuppressionsSearchParams.query,
    page: adminEmailSuppressionsSearchParams.page,
  });

  // Reset pagination so a new search never lands on an empty page.
  const onSearchQueryChange = (value: string) => {
    void setSearchParams({
      query: value || null,
      page: null,
    });
  };

  return (
    <div>
      <SettingsHeader
        hideDivider
        title={t`Email Suppressions`}
        subtitle={t`Email addresses that should not receive emails from a sender, or from anyone`}
      >
        <EmailSuppressionCreateDialog />
      </SettingsHeader>

      <div className="mt-4">
        <Input
          value={query ?? ''}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder={t`Search by email, organisation, team or user`}
          className="mb-4"
        />

        <AdminEmailSuppressionsTable />
      </div>
    </div>
  );
}
