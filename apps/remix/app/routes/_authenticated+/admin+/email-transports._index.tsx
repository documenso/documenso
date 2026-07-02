import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { EmailTransportCreateDialog } from '~/components/dialogs/email-transport-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { AdminEmailTransportsTable } from '~/components/tables/admin-email-transports-table';

export default function AdminEmailTransportsPage() {
  const { t } = useLingui();

  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

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

    // If nothing to change then do nothing.
    if (params.toString() === searchParams?.toString()) {
      return;
    }

    setSearchParams(params);
  }, [debouncedSearchQuery, pathname, searchParams]);

  return (
    <div>
      <SettingsHeader title={t`Email Transports`} subtitle={t`Manage all email transports`} hideDivider>
        <EmailTransportCreateDialog />
      </SettingsHeader>

      <div className="mt-4">
        <Input
          defaultValue={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t`Search by name or from address`}
          className="mb-4"
        />

        <AdminEmailTransportsTable />
      </div>
    </div>
  );
}
