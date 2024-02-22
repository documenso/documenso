import { getBanner } from '@documenso/lib/server-only/banner/get-banner';

import { BannerForm } from './banner-form';

export default async function AdminBannerPage() {
  const banner = await getBanner();

  return (
    <div className="space-y-8">
      <h2 className="text-4xl font-semibold">Banner</h2>

      <BannerForm show={banner?.show ?? false} text={banner?.text ?? ''} />
    </div>
  );
}
