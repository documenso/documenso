import { getBanner } from '@documenso/lib/server-only/banner/get-banner';

export const Banner = async () => {
  const banner = await getBanner();

  return (
    <>
      {banner && banner.show && (
        <div className="bg-documenso-200 dark:bg-documenso-400">
          <div className="text-documenso-900 mx-auto flex h-auto max-w-screen-xl items-center justify-center px-4 py-3 text-sm font-medium">
            <div className="flex items-center">{banner.text}</div>
          </div>
        </div>
      )}
    </>
  );
};

// Banner
// Custom Text
// Custom Text with Custom Icon
