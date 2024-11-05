import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getSiteSettings } from '@documenso/lib/server-only/site-settings/get-site-settings';
import { SITE_SETTINGS_BANNER_ID } from '@documenso/lib/server-only/site-settings/schemas/banner';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';

import { BannerForm } from './banner-form';

// import { BannerForm } from './banner-form';

export default async function AdminBannerPage() {
  await setupI18nSSR();

  const { _ } = useLingui();

  const banner = await getSiteSettings().then((settings) =>
    settings.find((setting) => setting.id === SITE_SETTINGS_BANNER_ID),
  );

  return (
    <div>
      <SettingsHeader
        title={_(msg`Site Settings`)}
        subtitle={_(msg`Manage your site settings here`)}
      />

      <div className="mt-8">
        <BannerForm banner={banner} />
      </div>
    </div>
  );
}
