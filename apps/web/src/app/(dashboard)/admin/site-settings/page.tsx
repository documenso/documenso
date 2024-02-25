import { getSiteSettings } from '@documenso/lib/server-only/site-settings/get-site-settings';
import { SITE_SETTINGS_BANNER_ID } from '@documenso/lib/server-only/site-settings/schemas/banner';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';

import { BannerForm } from './banner-form';

// import { BannerForm } from './banner-form';

export default async function AdminBannerPage() {
  const banner = await getSiteSettings().then((settings) =>
    settings.find((setting) => setting.id === SITE_SETTINGS_BANNER_ID),
  );

  return (
    <div>
      <SettingsHeader title="Site Settings" subtitle="Manage your site settings here" />

      <div className="mt-8">
        <BannerForm banner={banner} />
      </div>
    </div>
  );
}
