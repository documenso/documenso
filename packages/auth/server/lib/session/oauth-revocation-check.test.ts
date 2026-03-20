import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma before importing the module under test
vi.mock('@documenso/prisma', () => ({
  prisma: {
    account: {
      findMany: vi.fn(),
    },
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { prisma } from '@documenso/prisma';
import { validateOAuthGrant, clearOAuthCache } from './oauth-revocation-check';

const mockFindMany = vi.mocked(prisma.account.findMany);

describe('validateOAuthGrant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOAuthCache(1);
    clearOAuthCache(2);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true for users with no OAuth accounts (password-only)', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await validateOAuthGrant(1);

    expect(result).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return true when access token is expired (fail-open, not revocation)', async () => {
    // Token expired 1 hour ago — this is natural expiry, NOT revocation
    const expiredAt = Math.floor((Date.now() - 60 * 60 * 1000) / 1000);

    mockFindMany.mockResolvedValue([
      {
        provider: 'google',
        access_token: 'expired-token',
        expires_at: expiredAt,
      },
    ] as any);

    const result = await validateOAuthGrant(1);

    expect(result).toBe(true);
    // Should NOT have called fetch — expired tokens are skipped
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return false when provider returns 401 (token revoked)', async () => {
    // Token still valid (expires in 1 hour)
    const expiresAt = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);

    mockFindMany.mockResolvedValue([
      {
        provider: 'google',
        access_token: 'revoked-token',
        expires_at: expiresAt,
      },
    ] as any);

    mockFetch.mockResolvedValue({ status: 401, ok: false });

    const result = await validateOAuthGrant(1);

    expect(result).toBe(false);
  });

  it('should return false when provider returns 403 (token revoked)', async () => {
    const expiresAt = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);

    mockFindMany.mockResolvedValue([
      {
        provider: 'google',
        access_token: 'forbidden-token',
        expires_at: expiresAt,
      },
    ] as any);

    mockFetch.mockResolvedValue({ status: 403, ok: false });

    const result = await validateOAuthGrant(1);

    expect(result).toBe(false);
  });

  it('should return true when provider returns 200 (token valid)', async () => {
    const expiresAt = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);

    mockFindMany.mockResolvedValue([
      {
        provider: 'google',
        access_token: 'valid-token',
        expires_at: expiresAt,
      },
    ] as any);

    mockFetch.mockResolvedValue({ status: 200, ok: true });

    const result = await validateOAuthGrant(1);

    expect(result).toBe(true);
  });

  it('should return true when fetch throws (fail-open on network error)', async () => {
    const expiresAt = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);

    mockFindMany.mockResolvedValue([
      {
        provider: 'google',
        access_token: 'some-token',
        expires_at: expiresAt,
      },
    ] as any);

    mockFetch.mockRejectedValue(new Error('Network timeout'));

    const result = await validateOAuthGrant(1);

    expect(result).toBe(true);
  });

  it('should return true when access_token is null (fail-open)', async () => {
    const expiresAt = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);

    mockFindMany.mockResolvedValue([
      {
        provider: 'google',
        access_token: null,
        expires_at: expiresAt,
      },
    ] as any);

    const result = await validateOAuthGrant(1);

    expect(result).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should skip introspection for unknown providers (fail-open)', async () => {
    const expiresAt = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);

    mockFindMany.mockResolvedValue([
      {
        provider: 'github',
        access_token: 'some-token',
        expires_at: expiresAt,
      },
    ] as any);

    const result = await validateOAuthGrant(1);

    expect(result).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should use cached result within the 10-minute window', async () => {
    mockFindMany.mockResolvedValue([]);

    // First call — hits DB
    await validateOAuthGrant(1);
    expect(mockFindMany).toHaveBeenCalledTimes(1);

    // Second call — should use cache
    await validateOAuthGrant(1);
    expect(mockFindMany).toHaveBeenCalledTimes(1); // NOT called again
  });

  it('should use correct endpoint for Google', async () => {
    const expiresAt = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);

    mockFindMany.mockResolvedValue([
      {
        provider: 'google',
        access_token: 'google-token',
        expires_at: expiresAt,
      },
    ] as any);

    mockFetch.mockResolvedValue({ status: 200, ok: true });

    await validateOAuthGrant(1);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('googleapis.com/oauth2/v3/tokeninfo'),
      expect.any(Object),
    );
  });

  it('should use correct endpoint for Microsoft with Bearer header', async () => {
    const expiresAt = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);

    mockFindMany.mockResolvedValue([
      {
        provider: 'microsoft',
        access_token: 'ms-token',
        expires_at: expiresAt,
      },
    ] as any);

    mockFetch.mockResolvedValue({ status: 200, ok: true });

    await validateOAuthGrant(1);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/me',
      expect.objectContaining({
        headers: { Authorization: 'Bearer ms-token' },
      }),
    );
  });

  it('should return false for Google 400 with invalid_token error', async () => {
    const expiresAt = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);

    mockFindMany.mockResolvedValue([
      {
        provider: 'google',
        access_token: 'bad-token',
        expires_at: expiresAt,
      },
    ] as any);

    mockFetch.mockResolvedValue({
      status: 400,
      ok: false,
      json: () => Promise.resolve({ error: 'invalid_token' }),
    });

    const result = await validateOAuthGrant(1);

    expect(result).toBe(false);
  });
});

describe('clearOAuthCache', () => {
  it('should clear cache so next call hits the database', async () => {
    mockFindMany.mockResolvedValue([]);

    // Populate cache
    await validateOAuthGrant(1);
    expect(mockFindMany).toHaveBeenCalledTimes(1);

    // Clear it
    clearOAuthCache(1);

    // Should hit DB again
    await validateOAuthGrant(1);
    expect(mockFindMany).toHaveBeenCalledTimes(2);
  });
});
