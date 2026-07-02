import { describe, expect, it } from 'vitest';

import { isHttpUrl, toSafeHref } from './is-http-url';

describe('isHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isHttpUrl('http://example.com')).toBe(true);
    expect(isHttpUrl('https://example.com/path?q=1#hash')).toBe(true);
    expect(isHttpUrl('HTTPS://EXAMPLE.COM')).toBe(true);
  });

  it('rejects non-http(s) schemes', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('JavaScript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isHttpUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects non-absolute or unparseable values', () => {
    expect(isHttpUrl('not a url')).toBe(false);
    expect(isHttpUrl('/relative/path')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });

  it('does not treat leading whitespace tricks as safe', () => {
    // `new URL` trims leading control chars; ensure a smuggled scheme is rejected.
    expect(isHttpUrl(' javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('java\tscript:alert(1)')).toBe(false);
  });
});

describe('toSafeHref', () => {
  it('returns the URL when it is http(s)', () => {
    expect(toSafeHref('https://example.com')).toBe('https://example.com');
  });

  it('returns undefined for dangerous or empty values', () => {
    expect(toSafeHref('javascript:alert(1)')).toBeUndefined();
    expect(toSafeHref('data:text/html,x')).toBeUndefined();
    expect(toSafeHref('')).toBeUndefined();
    expect(toSafeHref(null)).toBeUndefined();
    expect(toSafeHref(undefined)).toBeUndefined();
  });
});
