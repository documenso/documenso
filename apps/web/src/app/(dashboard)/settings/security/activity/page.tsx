import type { Metadata } from 'next';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';

import ActivityPageBackButton from '../../../../../components/(dashboard)/settings/layout/activity-back';
import { UserSecurityActivityDataTable } from './user-security-activity-data-table';

export const metadata: Metadata = {
  title: 'Security activity',
};

export default async function SettingsSecurityActivityPage() {
  await setupI18nSSR();

  const { _ } = useLingui();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Security activity`)}
        subtitle={_(msg`View all security activity related to your account.`)}
        hideDivider={true}
      >
        <ActivityPageBackButton />
      </SettingsHeader>

      <div className="mt-4">
        <UserSecurityActivityDataTable />
      </div>
    </div>
  );
}
