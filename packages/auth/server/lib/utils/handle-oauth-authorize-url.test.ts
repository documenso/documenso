import type { Context } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OAuthClientOptions } from '../../config';
import { handleOAuthAuthorizeUrl, isOidcPrompt, resolvePrompt } from './handle-oauth-authorize-url';

vi.mock('./open-id', () => ({
  getOpenIdConfiguration: vi.fn().mockResolvedValue({
    authorization_endpoint: 'https://example.com/oauth/authorize',
  }),
}));

vi.mock('hono/cookie', () => ({
  setCookie: vi.fn(),
}));

describe('isOidcPrompt', () => {
  it('identifies valid OIDC prompt values', () => {
    expect(isOidcPrompt('none')).toBe(true);
    expect(isOidcPrompt('login')).toBe(true);
    expect(isOidcPrompt('consent')).toBe(true);
    expect(isOidcPrompt('select_account')).toBe(true);
  });

  it('rejects invalid prompt values', () => {
    expect(isOidcPrompt('')).toBe(false);
    expect(isOidcPrompt('invalid')).toBe(false);
    expect(isOidcPrompt('offline')).toBe(false);
    expect(isOidcPrompt(null)).toBe(false);
    expect(isOidcPrompt(undefined)).toBe(false);
  });
});

describe('resolvePrompt', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('generic OIDC provider', () => {
    it('returns undefined when NEXT_PRIVATE_OIDC_PROMPT is empty string', () => {
      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', '');

      expect(resolvePrompt('oidc')).toBeUndefined();
      expect(resolvePrompt({ provider: 'oidc' })).toBeUndefined();
      expect(resolvePrompt('oidc', 'consent')).toBeUndefined();
      expect(resolvePrompt({ provider: 'oidc', prompt: 'consent' })).toBeUndefined();
    });

    it('returns the configured env prompt when NEXT_PRIVATE_OIDC_PROMPT is valid', () => {
      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', 'consent');
      expect(resolvePrompt('oidc')).toBe('consent');
      expect(resolvePrompt({ provider: 'oidc', prompt: 'login' })).toBe('consent');

      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', 'none');
      expect(resolvePrompt('oidc')).toBe('none');

      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', 'select_account');
      expect(resolvePrompt('oidc')).toBe('select_account');

      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', 'login');
      expect(resolvePrompt('oidc')).toBe('login');
    });

    it('preserves existing behavior (route prompt or defaults to login) when variable is unset', () => {
      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', undefined);

      expect(resolvePrompt('oidc')).toBe('login');
      expect(resolvePrompt({ provider: 'oidc' })).toBe('login');
      expect(resolvePrompt('oidc', 'consent')).toBe('consent');
      expect(resolvePrompt({ provider: 'oidc', prompt: 'select_account' })).toBe('select_account');
    });

    it('ignores invalid env values and falls back to route prompt or login', () => {
      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', 'invalid_prompt');

      expect(resolvePrompt('oidc')).toBe('login');
      expect(resolvePrompt({ provider: 'oidc' })).toBe('login');
      expect(resolvePrompt('oidc', 'consent')).toBe('consent');
      expect(resolvePrompt({ provider: 'oidc', prompt: 'select_account' })).toBe('select_account');
    });
  });

  describe('other providers (isolation)', () => {
    it('does not apply OIDC env override to Google', () => {
      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', 'consent');
      expect(resolvePrompt('google')).toBe('login');
      expect(resolvePrompt({ provider: 'google' })).toBe('login');
      expect(resolvePrompt('google', 'select_account')).toBe('select_account');

      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', '');
      expect(resolvePrompt('google')).toBe('login');
      expect(resolvePrompt('google', 'select_account')).toBe('select_account');

      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', 'invalid');
      expect(resolvePrompt('google')).toBe('login');
    });

    it('does not apply OIDC env override to Microsoft', () => {
      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', 'consent');
      expect(resolvePrompt('microsoft')).toBe('login');
      expect(resolvePrompt({ provider: 'microsoft' })).toBe('login');
      expect(resolvePrompt('microsoft', 'select_account')).toBe('select_account');

      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', '');
      expect(resolvePrompt('microsoft')).toBe('login');

      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', 'invalid');
      expect(resolvePrompt('microsoft')).toBe('login');
    });

    it('does not apply OIDC env override to Organisation SSO', () => {
      const orgProviderId = 'org_cld1234567890';

      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', 'consent');
      expect(resolvePrompt(orgProviderId, 'select_account')).toBe('select_account');
      expect(resolvePrompt({ provider: orgProviderId, prompt: 'select_account' })).toBe('select_account');

      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', '');
      expect(resolvePrompt(orgProviderId, 'select_account')).toBe('select_account');
      expect(resolvePrompt({ provider: orgProviderId, prompt: 'select_account' })).toBe('select_account');

      vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', undefined);
      expect(resolvePrompt(orgProviderId, 'select_account')).toBe('select_account');
    });
  });
});

describe('handleOAuthAuthorizeUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const createMockContext = () => {
    return {
      json: vi.fn((data: unknown) => data),
    } as unknown as Context;
  };

  const createClientOptions = (id: string): OAuthClientOptions => ({
    id,
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUrl: 'https://documenso.com/api/auth/callback',
    wellKnownUrl: 'https://auth.example.com/.well-known/openid-configuration',
    scope: ['openid', 'email', 'profile'],
  });

  it('omits prompt query parameter when NEXT_PRIVATE_OIDC_PROMPT is empty string for OIDC', async () => {
    vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', '');

    const c = createMockContext();
    const result = (await handleOAuthAuthorizeUrl({
      c,
      clientOptions: createClientOptions('oidc'),
    })) as unknown as { redirectUrl: string };

    const url = new URL(result.redirectUrl);
    expect(url.searchParams.has('prompt')).toBe(false);
  });

  it('sets configured prompt query parameter when NEXT_PRIVATE_OIDC_PROMPT is valid for OIDC', async () => {
    vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', 'consent');

    const c = createMockContext();
    const result = (await handleOAuthAuthorizeUrl({
      c,
      clientOptions: createClientOptions('oidc'),
    })) as unknown as { redirectUrl: string };

    const url = new URL(result.redirectUrl);
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('defaults to login prompt parameter when NEXT_PRIVATE_OIDC_PROMPT is unset for OIDC', async () => {
    vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', undefined);

    const c = createMockContext();
    const result = (await handleOAuthAuthorizeUrl({
      c,
      clientOptions: createClientOptions('oidc'),
    })) as unknown as { redirectUrl: string };

    const url = new URL(result.redirectUrl);
    expect(url.searchParams.get('prompt')).toBe('login');
  });

  it('preserves prompt for other providers even if NEXT_PRIVATE_OIDC_PROMPT is empty', async () => {
    vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', '');

    const c = createMockContext();
    const result = (await handleOAuthAuthorizeUrl({
      c,
      clientOptions: createClientOptions('google'),
    })) as unknown as { redirectUrl: string };

    const url = new URL(result.redirectUrl);
    expect(url.searchParams.get('prompt')).toBe('login');
  });

  it('preserves select_account prompt for Organisation SSO even if NEXT_PRIVATE_OIDC_PROMPT is empty or set', async () => {
    vi.stubEnv('NEXT_PRIVATE_OIDC_PROMPT', '');

    const c = createMockContext();
    const result = (await handleOAuthAuthorizeUrl({
      c,
      clientOptions: createClientOptions('org_cld1234567890'),
      prompt: 'select_account',
    })) as unknown as { redirectUrl: string };

    const url = new URL(result.redirectUrl);
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });
});
