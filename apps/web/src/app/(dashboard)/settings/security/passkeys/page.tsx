import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getServerComponentFlag } from '@documenso/lib/server-only/feature-flags/get-server-component-feature-flag';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';

import { CreatePasskeyDialog } from './create-passkey-dialog';
import { UserPasskeysDataTable } from './user-passkeys-data-table';

export const metadata: Metadata = {
  title: 'Manage passkeys',
};

export default async function SettingsManagePasskeysPage() {
  await setupI18nSSR();

  const { _ } = useLingui();
  const isPasskeyEnabled = await getServerComponentFlag('app_passkey');

  if (!isPasskeyEnabled) {
    redirect('/settings/security');
  }

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
        <UserPasskeysDataTable />
      </div>
    </div>
  );
}
