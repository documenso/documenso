import type { Metadata } from 'next';

import type { PageParams } from '@documenso/lib/types/page-params';

import initTranslations from '~/app/i18n';

import { UserSecurityActivityDataTable } from './user-security-activity-data-table';

export const metadata: Metadata = {
  title: 'Security activity',
};

export default async function SettingsSecurityActivityPage({ params: { locale } }: PageParams) {
  const { t } = await initTranslations(locale);
  return (
    <div>
      <h3 className="text-2xl font-semibold">{t('security_activity')}</h3>

      <p className="text-muted-foreground mt-2 text-sm">{t('view_all_recent_security_activity')}</p>

      <hr className="my-4" />

      <UserSecurityActivityDataTable />
    </div>
  );
}
