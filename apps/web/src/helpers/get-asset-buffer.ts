/**
 * getAssetBuffer is used to retrieve array buffers for various assets
 * that are hosted in the `public` folder.
 *
 * This exists due to a breakage with `import.meta.url` imports and open graph images,
 * once we can identify a fix for this, we can remove this helper.
 *
 * @param path The path to the asset, relative to the `public` folder.
 */
import { env } from '~/env.mjs';

export const getAssetBuffer = async (path: string) => {
  const baseUrl = env.NEXT_PUBLIC_WEBAPP_URL;

  return fetch(new URL(path, baseUrl)).then(async (res) => res.arrayBuffer());
};
