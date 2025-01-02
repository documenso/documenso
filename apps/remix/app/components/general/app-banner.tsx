import { type TSiteSettingsBannerSchema } from '@documenso/lib/server-only/site-settings/schemas/banner';

export type AppBannerProps = {
  banner: TSiteSettingsBannerSchema;
};

export const AppBanner = ({ banner }: AppBannerProps) => {
  if (!banner.enabled) {
    return null;
  }

  return (
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
  );
};

// Banner
// Custom Text
// Custom Text with Custom Icon
