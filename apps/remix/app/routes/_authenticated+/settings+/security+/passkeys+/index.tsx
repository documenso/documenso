import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { PasskeyCreateDialog } from '~/components/dialogs/passkey-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { SettingsSecurityPasskeyTable } from '~/components/tables/settings-security-passkey-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Manage passkeys');
}

export default function SettingsPasskeys() {
  const { _ } = useLingui();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Passkeys`)}
        subtitle={_(msg`Manage your passkeys.`)}
        hideDivider={true}
      >
        <PasskeyCreateDialog />
      </SettingsHeader>

      <div className="mt-4">
        <SettingsSecurityPasskeyTable />
      </div>
    </div>
  );
}
