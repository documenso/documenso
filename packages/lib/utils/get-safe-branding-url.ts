export const getSafeBrandingUrl = (brandingUrl?: string | null) => {
  if (!brandingUrl) {
    return null;
  }

  try {
    const url = new URL(brandingUrl);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
};
