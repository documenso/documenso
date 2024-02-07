import type { Metadata } from 'next';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import type { PageParams } from '@documenso/lib/types/page-params';

import initTranslations from '~/app/i18n';
import { ProfileForm } from '~/components/forms/profile';

export const metadata: Metadata = {
  title: 'Profile',
};

export default async function ProfileSettingsPage({ params: { locale } }: PageParams) {
  const { t } = await initTranslations(locale);
  const { user } = await getRequiredServerComponentSession();

  return (
    <div>
      <h3 className="text-2xl font-semibold">{t('profile')}</h3>

      <p className="text-muted-foreground mt-2 text-sm">{t('edit_personal_details')}</p>

      <hr className="my-4" />

      <ProfileForm user={user} className="max-w-xl" />
    </div>
  );
}
