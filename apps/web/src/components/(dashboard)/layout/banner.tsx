import { getSiteSettings } from '@documenso/lib/server-only/site-settings/get-site-settings';
import { SITE_SETTINGS_BANNER_ID } from '@documenso/lib/server-only/site-settings/schemas/banner';

export const Banner = async () => {
  const banner = await getSiteSettings().then((settings) =>
    settings.find((setting) => setting.id === SITE_SETTINGS_BANNER_ID),
  );

  return (
    <>
      {banner && banner.enabled && (
        <div className="mb-2" style={{ background: banner.data.bgColor }}>
          <div
            className="mx-auto flex h-auto max-w-screen-xl items-center justify-center px-4 py-3 text-sm font-medium"
            style={{ color: banner.data.textColor }}
          >
            <div className="flex items-center">
              <span dangerouslySetInnerHTML={{ __html: banner.data.content }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Banner
// Custom Text
// Custom Text with Custom Icon
