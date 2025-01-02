import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { CreatePasskeyDialog } from '~/components/dialogs/create-passkey-dialog';
import { SettingsSecurityPasskeyTable } from '~/components/tables/settings-security-passkey-table';

import type { Route } from './+types/index';

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Manage passkeys' }];
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
        <CreatePasskeyDialog />
      </SettingsHeader>

      <div className="mt-4">
        <SettingsSecurityPasskeyTable />
      </div>
    </div>
  );
}
