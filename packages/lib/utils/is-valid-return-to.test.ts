import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getReturnToFromRequest, getValidReturnTo, withReturnTo, ZReturnToSchema } from './is-valid-return-to';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_WEBAPP_URL', 'https://app.example.com');
  vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getValidReturnTo', () => {
  it('preserves the invitation path, query, and fragment through email URL encoding', () => {
    const destination = '/organisation/invite/token?action=accept&source=email#invitation';
    const verificationUrl = new URL('https://app.example.com/verify-email/verification-token');
    verificationUrl.searchParams.set('returnTo', destination);

    expect(getValidReturnTo(verificationUrl.searchParams.get('returnTo') ?? undefined)).toBe(destination);
  });

  it('normalizes same-origin destinations to app-relative paths without the base path', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/ESign');

    expect(getValidReturnTo('https://app.example.com/ESign/organisation/invite/token')).toBe(
      '/organisation/invite/token',
    );
    expect(getValidReturnTo('/ESign/organisation/invite/token')).toBe('/organisation/invite/token');
    expect(getValidReturnTo('/organisation/invite/token')).toBe('/organisation/invite/token');
    expect(getValidReturnTo('/ESign')).toBe('/');
    expect(getValidReturnTo('/ESignature/inbox')).toBe('/ESignature/inbox');
  });

  it('is idempotent so a value can be re-validated at every boundary', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/ESign');

    const once = getValidReturnTo('/organisation/invite/token?action=accept#top');

    expect(getValidReturnTo(once)).toBe(once);
  });

  it.each([
    undefined,
    '',
    'https://external.example.com',
    '//external.example.com',
    '%2F%2Fexternal.example.com',
    'https://app.example.com//external.example.com',
    '/%2Fexternal.example.com',
    '/%252Fexternal.example.com',
    'javascript:alert(1)',
    '%invalid',
  ])('discards unsafe or missing destinations: %s', (destination) => {
    expect(getValidReturnTo(destination)).toBeUndefined();
  });

  it.each([
    '/api',
    '/api?x=1',
    '/api/auth/embed/complete?state=abc',
    'https://app.example.com/api/auth/signout',
    '/%2561pi/auth/signout',
  ])('rejects API routes by default: %s', (destination) => {
    expect(getValidReturnTo(destination)).toBeUndefined();
  });

  it('rejects API routes under a base path whether or not the prefix is present', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/ESign');

    expect(getValidReturnTo('/api/auth/embed/complete')).toBeUndefined();
    expect(getValidReturnTo('/ESign/api/auth/embed/complete')).toBeUndefined();
  });

  it('accepts API routes only when explicitly allowed', () => {
    const embedCompletion = '/api/auth/embed/complete?state=abc';

    expect(getValidReturnTo(embedCompletion, { allowApiRoutes: true })).toBe(embedCompletion);
    expect(getValidReturnTo('//external.example.com', { allowApiRoutes: true })).toBeUndefined();
  });
});

describe('getReturnToFromRequest', () => {
  it('reads and validates the returnTo query parameter', () => {
    expect(getReturnToFromRequest(new Request('https://app.example.com/signin?returnTo=%2Finbox'))).toBe('/inbox');
    expect(getReturnToFromRequest(new Request('https://app.example.com/signin'))).toBeUndefined();
    expect(
      getReturnToFromRequest(new Request('https://app.example.com/signin?returnTo=https%3A%2F%2Fexternal.example.com')),
    ).toBeUndefined();
  });
});

describe('ZReturnToSchema', () => {
  it('normalizes valid destinations and drops invalid ones instead of failing', () => {
    expect(ZReturnToSchema.parse('https://app.example.com/inbox')).toBe('/inbox');
    expect(ZReturnToSchema.parse('/api/auth/embed/complete')).toBeUndefined();
    expect(ZReturnToSchema.parse('https://external.example.com')).toBeUndefined();
    expect(ZReturnToSchema.parse(undefined)).toBeUndefined();
  });
});

describe('withReturnTo', () => {
  it('returns the path untouched without a destination', () => {
    expect(withReturnTo('/signin')).toBe('/signin');
    expect(withReturnTo('/signin', undefined)).toBe('/signin');
    expect(withReturnTo('/signin', '')).toBe('/signin');
  });

  it('appends an encoded returnTo query parameter', () => {
    expect(withReturnTo('/signin', '/organisation/invite/token?action=accept')).toBe(
      '/signin?returnTo=%2Forganisation%2Finvite%2Ftoken%3Faction%3Daccept',
    );
  });

  it('chains onto an existing query string', () => {
    expect(withReturnTo('/signin?source=email', '/inbox')).toBe('/signin?source=email&returnTo=%2Finbox');
  });
});
