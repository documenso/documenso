import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import { SettingsHeader } from '~/components/general/settings-header';
import { AdminTagsTable } from '~/components/tables/admin-tags-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Tags`);
}

export default function AdminTagsPage() {
  return (
    <div>
      <SettingsHeader
        hideDivider
        title={<Trans>Tags</Trans>}
        subtitle={<Trans>Every tag on a user or organisation, added by an admin or a rule.</Trans>}
      />

      <AdminTagsTable />
    </div>
  );
}
