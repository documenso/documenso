/**
 * Resolve a static email asset path against the asset base URL.
 *
 * The base is normalised to end with a trailing slash and the path is
 * normalised to have no leading slash, so a sub-path in the base URL
 * (e.g. "/ESign") is preserved. Passing a root-absolute path straight to
 * `new URL()` would otherwise replace the base pathname entirely.
 *
 * `getEmailAssetUrl('https://host/ESign', 'static/logo.png')` -> `https://host/ESign/static/logo.png`
 * `getEmailAssetUrl('https://host/ESign/', '/static/logo.png')` -> `https://host/ESign/static/logo.png`
 */
export const getEmailAssetUrl = (assetBaseUrl: string, path: string): string => {
  const base = assetBaseUrl.endsWith('/') ? assetBaseUrl : `${assetBaseUrl}/`;
  const relativePath = path.startsWith('/') ? path.slice(1) : path;

  return new URL(relativePath, base).toString();
};
