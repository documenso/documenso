import { describe, expect, it } from 'vitest';

import { getSafeBrandingUrl } from './get-safe-branding-url';

describe('getSafeBrandingUrl', () => {
  it('returns normalized absolute http and https URLs', () => {
    expect(getSafeBrandingUrl('https://example.com/brand?from=signing')).toBe('https://example.com/brand?from=signing');
    expect(getSafeBrandingUrl('http://example.com')).toBe('http://example.com/');
  });

  it('rejects missing, relative, invalid, and non-http URLs', () => {
    expect(getSafeBrandingUrl()).toBeNull();
    expect(getSafeBrandingUrl(null)).toBeNull();
    expect(getSafeBrandingUrl('')).toBeNull();
    expect(getSafeBrandingUrl('/relative')).toBeNull();
    expect(getSafeBrandingUrl('not a url')).toBeNull();
    expect(getSafeBrandingUrl('mailto:support@example.com')).toBeNull();
    expect(getSafeBrandingUrl('javascript:alert(1)')).toBeNull();
  });
});
