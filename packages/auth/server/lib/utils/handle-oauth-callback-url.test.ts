// ABOUTME: Regression tests proving Google OAuth first-login auto-provisioning is
// ABOUTME: unaffected by the password-signup-only flag and still respects the blanket flag.

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HonoAuthContext } from '../../types/context';
import type { OAuthClientOptions } from '../../config';

const mockEnv = vi.fn();
const mockValidateAuthorizationCode = vi.fn();
const mockDecodeIdToken = vi.fn();
const mockGetOpenIdConfiguration = vi.fn();
const mockOnAuthorize = vi.fn();
const mockOnCreateUserHook = vi.fn();
const mockSyncGoogleDirectory = vi.fn();
const mockUserCreate = vi.fn();
const mockAccountCreate = vi.fn();

const mockPrisma = {
  account: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
    fn({
      user: { create: mockUserCreate },
      account: { create: mockAccountCreate },
    }),
  ),
};

vi.mock('@documenso/lib/utils/env', () => ({
  env: mockEnv,
}));

vi.mock('@documenso/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('arctic', () => ({
  OAuth2Client: vi.fn().mockImplementation(function OAuth2Client() {
    return { validateAuthorizationCode: mockValidateAuthorizationCode };
  }),
  decodeIdToken: mockDecodeIdToken,
}));

vi.mock('./open-id', () => ({
  getOpenIdConfiguration: mockGetOpenIdConfiguration,
}));

vi.mock('./authorizer', () => ({
  onAuthorize: mockOnAuthorize,
}));

vi.mock('@documenso/lib/server-only/user/create-user', () => ({
  onCreateUserHook: mockOnCreateUserHook,
}));

vi.mock('@documenso/lib/server-only/user/sync-google-directory', () => ({
  syncGoogleDirectory: mockSyncGoogleDirectory,
}));

const testClientOptions: OAuthClientOptions = {
  id: 'google',
  scope: ['openid', 'email', 'profile'],
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUrl: 'http://localhost:3000/api/auth/callback/google',
  wellKnownUrl: 'https://accounts.google.com/.well-known/openid-configuration',
};

const newUserClaims = {
  email: 'newstaffer@psd401.net',
  name: 'New Staffer',
  sub: 'google-sub-123',
  email_verified: true,
};

const buildTestApp = async () => {
  const { handleOAuthCallbackUrl } = await import('./handle-oauth-callback-url');

  return new Hono<HonoAuthContext>()
    .use(async (c, next) => {
      c.set('requestMetadata', { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      await next();
    })
    .get('/callback', async (c) => handleOAuthCallbackUrl({ c, clientOptions: testClientOptions }));
};

const requestCallback = async (app: Awaited<ReturnType<typeof buildTestApp>>) =>
  app.request('/callback?code=testcode789&state=teststate123', {
    headers: {
      Cookie: [
        'google_oauth_state=teststate123',
        'google_code_verifier=testverifier456',
        `google_redirect_path=${encodeURIComponent('teststate123 /')}`,
      ].join('; '),
    },
  });

describe('handleOAuthCallbackUrl new user provisioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetOpenIdConfiguration.mockResolvedValue({ token_endpoint: 'https://example.com/token' });
    mockValidateAuthorizationCode.mockResolvedValue({
      accessToken: () => 'fake-access-token',
      accessTokenExpiresAt: () => new Date(Date.now() + 3600_000),
      idToken: () => 'fake-id-token',
    });
    mockDecodeIdToken.mockReturnValue(newUserClaims);

    mockPrisma.account.findFirst.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({ id: 42, email: newUserClaims.email, name: newUserClaims.name });
    mockAccountCreate.mockResolvedValue({});

    mockOnAuthorize.mockResolvedValue(undefined);
    mockOnCreateUserHook.mockResolvedValue(undefined);
    mockSyncGoogleDirectory.mockResolvedValue(undefined);
  });

  it('still auto-provisions a new account when only NEXT_PUBLIC_DISABLE_PASSWORD_SIGNUP is set', async () => {
    mockEnv.mockImplementation((key: string) =>
      key === 'NEXT_PUBLIC_DISABLE_PASSWORD_SIGNUP' ? 'true' : undefined,
    );

    const app = await buildTestApp();
    const response = await requestCallback(app);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/');
    expect(mockUserCreate).toHaveBeenCalledTimes(1);
    expect(mockOnCreateUserHook).toHaveBeenCalledTimes(1);
    expect(mockOnAuthorize).toHaveBeenCalledWith({ userId: 42 }, expect.anything());
  });

  it('still blocks new OAuth signups when the blanket NEXT_PUBLIC_DISABLE_SIGNUP flag is set', async () => {
    mockEnv.mockImplementation((key: string) =>
      key === 'NEXT_PUBLIC_DISABLE_SIGNUP' ? 'true' : undefined,
    );

    const app = await buildTestApp();
    const response = await requestCallback(app);

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get('location') ?? '', 'http://localhost').pathname).toBe(
      '/signin',
    );
    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});
