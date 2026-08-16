import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleOAuthRevocation } from './handle-oauth-revocation';

const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

const hoisted = vi.hoisted(() => ({
  issuer: 'https://accounts.google.com',
  audience: 'test-google-client-id',
  publicJwk: null as any,
}));

vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();

  return {
    ...actual,
    createRemoteJWKSet: vi.fn(() =>
      hoisted.publicJwk
        ? actual.createLocalJWKSet({ keys: [hoisted.publicJwk] })
        : actual.createRemoteJWKSet(new URL('https://example.com/jwks')),
    ),
  };
});

vi.mock('../../config', () => ({
  GoogleAuthOptions: {
    id: 'google',
    clientId: hoisted.audience,
    wellKnownUrl: 'https://accounts.google.com/.well-known/openid-configuration',
  },
  MicrosoftAuthOptions: {
    id: 'microsoft',
    clientId: 'test-microsoft-client-id',
    wellKnownUrl: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
  },
  OidcAuthOptions: {
    id: 'oidc',
    clientId: '',
    wellKnownUrl: '',
  },
}));

vi.mock('./open-id', () => ({
  getOpenIdConfiguration: vi.fn().mockResolvedValue({
    issuer: hoisted.issuer,
    jwks_uri: 'https://example.com/jwks',
  }),
}));

vi.mock('@prisma/client', () => ({
  UserSecurityAuditLogType: {
    SESSION_REVOKED: 'SESSION_REVOKED',
    SIGN_OUT: 'SIGN_OUT',
    ACCOUNT_SSO_UNLINK: 'ACCOUNT_SSO_UNLINK',
  },
}));

vi.mock('@documenso/prisma', () => {
  const mockPrisma = {
    account: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    session: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    userSecurityAuditLog: {
      createMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation((cb: any) => cb(mockPrisma)),
  };

  return {
    prisma: mockPrisma,
    UserSecurityAuditLogType: {
      SESSION_REVOKED: 'SESSION_REVOKED',
      SIGN_OUT: 'SIGN_OUT',
      ACCOUNT_SSO_UNLINK: 'ACCOUNT_SSO_UNLINK',
    },
  };
});

describe('OAuth Access Revocation & Session Invalidation Handler', () => {
  const mockContext = {
    get: vi.fn().mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'Vitest-Agent' }),
    json: vi.fn().mockImplementation((data, status) => ({ data, status })),
  };

  let privateKey: any;

  const signLogoutToken = async (
    overrides: {
      iss?: string;
      sub?: string;
      nonce?: string;
      events?: Record<string, unknown>;
      signature?: string;
    } = {},
  ): Promise<string> => {
    const jwt = new SignJWT({
      events: overrides.events !== undefined ? overrides.events : { [BACKCHANNEL_LOGOUT_EVENT]: {} },
      ...(overrides.nonce !== undefined ? { nonce: overrides.nonce } : {}),
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(overrides.iss ?? hoisted.issuer)
      .setAudience(hoisted.audience)
      .setIssuedAt()
      .setExpirationTime('10m');

    if (overrides.sub !== undefined) {
      jwt.setSubject(overrides.sub);
    }

    const signed = await jwt.sign(privateKey);

    if (overrides.signature !== undefined) {
      const [header, payload] = signed.split('.');
      return `${header}.${payload}.${overrides.signature}`;
    }

    return signed;
  };

  beforeAll(async () => {
    const { publicKey, privateKey: signingKey } = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(publicKey);

    publicJwk.alg = 'RS256';
    publicJwk.use = 'sig';

    hoisted.publicJwk = publicJwk;
    privateKey = signingKey;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. verifies a real signed logout token, invalidates sessions and unlinks the account', async () => {
    const logoutToken = await signLogoutToken({ sub: 'backchannel_sub_456' });

    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce({
      id: 'acc_456',
      userId: 88,
      provider: 'google',
    } as any);
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([{ id: 'sess_bc' }] as any);
    vi.mocked(prisma.session.deleteMany).mockResolvedValueOnce({ count: 1 } as any);
    vi.mocked(prisma.userSecurityAuditLog.createMany).mockResolvedValueOnce({ count: 1 } as any);
    vi.mocked(prisma.userSecurityAuditLog.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.account.delete).mockResolvedValueOnce({} as any);

    const res = await handleOAuthRevocation({
      c: mockContext as any,
      logoutToken,
    });

    expect(prisma.account.findFirst).toHaveBeenCalledWith({
      where: { providerAccountId: 'backchannel_sub_456', provider: 'google' },
      select: { id: true, userId: true, provider: true },
    });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 88 } });
    expect(prisma.account.delete).toHaveBeenCalledWith({ where: { id: 'acc_456' } });
    expect(prisma.userSecurityAuditLog.create).toHaveBeenCalledWith({
      data: { userId: 88, ipAddress: '127.0.0.1', userAgent: 'Vitest-Agent', type: 'ACCOUNT_SSO_UNLINK' },
    });
    expect(res).toEqual({
      data: { success: true, message: 'OAuth access revoked and sessions terminated' },
      status: 200,
    });
  });

  it('2. returns idempotent 200 when the account no longer exists', async () => {
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce(null);

    const res = await handleOAuthRevocation({
      c: mockContext as any,
      logoutToken: await signLogoutToken({ sub: 'non_existent_sub_000' }),
    });

    expect(prisma.session.findMany).not.toHaveBeenCalled();
    expect(prisma.account.delete).not.toHaveBeenCalled();
    expect(res).toEqual({
      data: { success: true, message: 'No associated account found' },
      status: 200,
    });
  });

  it('3. throws INVALID_REQUEST when no logout token is provided', async () => {
    await expect(
      handleOAuthRevocation({
        c: mockContext as any,
      }),
    ).rejects.toThrowError(AppError);
  });

  it('4. throws INVALID_REQUEST for a malformed JWT', async () => {
    await expect(
      handleOAuthRevocation({
        c: mockContext as any,
        logoutToken: 'header.invalid_payload.signature',
      }),
    ).rejects.toThrowError(AppError);
  });

  it('5. rejects a token with a tampered signature before touching the database', async () => {
    const logoutToken = await signLogoutToken({
      sub: 'backchannel_sub_456',
      signature: 'tampered_signature',
    });

    await expect(
      handleOAuthRevocation({
        c: mockContext as any,
        logoutToken,
      }),
    ).rejects.toThrowError(AppError);

    expect(prisma.account.findFirst).not.toHaveBeenCalled();
  });

  it('6. rejects a token whose issuer does not match the pinned provider issuer', async () => {
    const logoutToken = await signLogoutToken({
      iss: 'https://accounts.google.com.evil.com',
      sub: 'backchannel_sub_456',
    });

    await expect(
      handleOAuthRevocation({
        c: mockContext as any,
        logoutToken,
      }),
    ).rejects.toThrowError(AppError);

    expect(prisma.account.findFirst).not.toHaveBeenCalled();
  });

  it('7. rejects a validly signed token without a subject (sub) claim', async () => {
    const logoutToken = await signLogoutToken({});

    await expect(
      handleOAuthRevocation({
        c: mockContext as any,
        logoutToken,
      }),
    ).rejects.toThrowError('Logout token is missing the subject (sub) claim');
  });

  it('8. rejects a logout token containing a nonce', async () => {
    const logoutToken = await signLogoutToken({ sub: 'backchannel_sub_456', nonce: 'unexpected' });

    await expect(
      handleOAuthRevocation({
        c: mockContext as any,
        logoutToken,
      }),
    ).rejects.toThrowError('Logout token must not contain a nonce');
  });

  it('9. unlinks the account and logs even when the user has no active sessions', async () => {
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce({
      id: 'acc_789',
      userId: 99,
      provider: 'google',
    } as any);
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.account.delete).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.userSecurityAuditLog.create).mockResolvedValueOnce({} as any);

    const res = await handleOAuthRevocation({
      c: mockContext as any,
      logoutToken: await signLogoutToken({ sub: 'ms_sub_789' }),
    });

    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(prisma.userSecurityAuditLog.createMany).not.toHaveBeenCalled();
    expect(prisma.account.delete).toHaveBeenCalledWith({ where: { id: 'acc_789' } });
    expect(prisma.userSecurityAuditLog.create).toHaveBeenCalledWith({
      data: { userId: 99, ipAddress: '127.0.0.1', userAgent: 'Vitest-Agent', type: 'ACCOUNT_SSO_UNLINK' },
    });
    expect(res).toEqual({
      data: { success: true, message: 'OAuth access revoked and sessions terminated' },
      status: 200,
    });
  });

  it('10. rejects a validly signed token without the back-channel logout event', async () => {
    const logoutToken = await signLogoutToken({ sub: 'backchannel_sub_456', events: {} });

    await expect(
      handleOAuthRevocation({
        c: mockContext as any,
        logoutToken,
      }),
    ).rejects.toThrowError('Missing back-channel logout event claim');

    expect(prisma.account.findFirst).not.toHaveBeenCalled();
  });
});
