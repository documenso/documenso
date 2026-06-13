process.env.NEXTAUTH_SECRET = 'test-secret';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock prisma
vi.mock('@documenso/prisma', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock validateTwoFactorAuthentication
const mockValidate2fa = vi.fn();
vi.mock('@documenso/lib/server-only/2fa/validate-2fa', () => ({
  validateTwoFactorAuthentication: (options: any) => mockValidate2fa(options),
}));

// Mock Hono context, authorizer, and signed cookie helpers
const mockSetSignedCookie = vi.fn();
const mockGetSignedCookie = vi.fn();
const mockDeleteCookie = vi.fn();
vi.mock('hono/cookie', () => ({
  setSignedCookie: (c: any, name: any, val: any, secret: any, opts: any) =>
    mockSetSignedCookie(c, name, val, secret, opts),
  getSignedCookie: (c: any, secret: any, name: any) => mockGetSignedCookie(c, secret, name),
  deleteCookie: (c: any, name: any, opts: any) => mockDeleteCookie(c, name, opts),
}));

const mockOnAuthorize = vi.fn();
vi.mock('../lib/utils/authorizer', () => ({
  onAuthorize: (user: any, c: any) => mockOnAuthorize(user, c),
}));

import { prisma } from '@documenso/prisma';
import { deleteOAuth2faPendingCookie, getOAuth2faPendingCookie, setOAuth2faPendingCookie } from './session-cookies';

const mockFindFirst = vi.mocked(prisma.user.findFirst);

describe('OAuth 2FA pending signed state cookies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully store user state in signed pending cookie', async () => {
    const c = {} as any;
    mockSetSignedCookie.mockResolvedValue(undefined);

    await setOAuth2faPendingCookie(c, { userId: 42, redirectPath: '/dashboard' });

    expect(mockSetSignedCookie).toHaveBeenCalledWith(
      c,
      expect.stringContaining('oauth2faPending'),
      JSON.stringify({ userId: 42, redirectPath: '/dashboard' }),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('should retrieve and parse user state from signed pending cookie', async () => {
    const c = {} as any;
    mockGetSignedCookie.mockResolvedValue(JSON.stringify({ userId: 42, redirectPath: '/dashboard' }));

    const result = await getOAuth2faPendingCookie(c);

    expect(result).toEqual({ userId: 42, redirectPath: '/dashboard' });
  });

  it('should return null if signed pending cookie is missing', async () => {
    const c = {} as any;
    mockGetSignedCookie.mockResolvedValue(undefined);

    const result = await getOAuth2faPendingCookie(c);

    expect(result).toBeNull();
  });

  it('should delete pending cookie during cleanup', () => {
    const c = {} as any;

    deleteOAuth2faPendingCookie(c);

    expect(mockDeleteCookie).toHaveBeenCalledWith(c, expect.stringContaining('oauth2faPending'), expect.any(Object));
  });
});
