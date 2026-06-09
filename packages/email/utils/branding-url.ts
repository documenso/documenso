/**
 * Returns the normalized Brand Website URL only when it is a safe absolute
 * http(s) URL.
 *
 * Rendering must be defensive because old/imported data can bypass the branding
 * form validation. Empty, missing, invalid, relative, or non-http(s) values are
 * treated as no Brand Website.
 */
export const getSafeBrandingUrl = (brandingUrl: string | null | undefined): string | null => {
  if (!brandingUrl) {
    return null;
  }

  const parsed = URL.parse(brandingUrl);

  if (parsed?.protocol !== 'http:' && parsed?.protocol !== 'https:') {
    return null;
  }

  return parsed.href;
};
