import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleOAuthRevocation } from './handle-oauth-revocation';

vi.mock('@prisma/client', () => ({
  UserSecurityAuditLogType: {
    SESSION_REVOKED: 'SESSION_REVOKED',
    SIGN_OUT: 'SIGN_OUT',
    ACCOUNT_SSO_UNLINK: 'ACCOUNT_SSO_UNLINK',
  },
}));

vi.mock('jose', () => ({
  decodeJwt: vi.fn((token: string) => {
    if (token.includes('invalid') || token.includes('throws_error')) {
      throw new Error('Invalid JWT signature or payload');
    }
    const parts = token.split('.');
    if (parts.length < 2) {
      return {};
    }
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  }),
  jwtVerify: vi.fn().mockResolvedValue({}),
  createRemoteJWKSet: vi.fn().mockReturnValue(() => ({})),
}));

vi.mock('./open-id', () => ({
  getOpenIdConfiguration: vi.fn().mockResolvedValue({
    jwks_uri: 'https://example.com/jwks',
  }),
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. should invalidate active sessions and remove account link when providerAccountId is supplied', async () => {
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce({
      id: 'acc_123',
      userId: 42,
      provider: 'google',
    } as any);
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([{ id: 'sess_1' }, { id: 'sess_2' }] as any);
    vi.mocked(prisma.session.deleteMany).mockResolvedValueOnce({ count: 2 } as any);
    vi.mocked(prisma.userSecurityAuditLog.createMany).mockResolvedValueOnce({ count: 2 } as any);
    vi.mocked(prisma.userSecurityAuditLog.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.account.delete).mockResolvedValueOnce({} as any);

    const res = await handleOAuthRevocation({
      c: mockContext as any,
      providerAccountId: 'google_user_sub_99',
      provider: 'google',
    });

    expect(prisma.account.findFirst).toHaveBeenCalledWith({
      where: { providerAccountId: 'google_user_sub_99', provider: 'google' },
      select: { id: true, userId: true, provider: true },
    });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 42 } });
    expect(prisma.userSecurityAuditLog.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 42, ipAddress: '127.0.0.1', userAgent: 'Vitest-Agent', type: 'SESSION_REVOKED' },
        { userId: 42, ipAddress: '127.0.0.1', userAgent: 'Vitest-Agent', type: 'SESSION_REVOKED' },
      ],
    });
    expect(prisma.account.delete).toHaveBeenCalledWith({ where: { id: 'acc_123' } });
    expect(prisma.userSecurityAuditLog.create).toHaveBeenCalledWith({
      data: { userId: 42, ipAddress: '127.0.0.1', userAgent: 'Vitest-Agent', type: 'ACCOUNT_SSO_UNLINK' },
    });
    expect(res).toEqual({
      data: { success: true, message: 'OAuth access revoked and sessions terminated' },
      status: 200,
    });
  });

  it('2. should handle non-existent user/account gracefully (idempotent HTTP 200)', async () => {
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce(null);

    const res = await handleOAuthRevocation({
      c: mockContext as any,
      providerAccountId: 'non_existent_sub_000',
    });

    expect(prisma.account.findFirst).toHaveBeenCalledWith({
      where: { providerAccountId: 'non_existent_sub_000' },
      select: { id: true, userId: true, provider: true },
    });
    expect(prisma.session.findMany).not.toHaveBeenCalled();
    expect(prisma.account.delete).not.toHaveBeenCalled();
    expect(res).toEqual({
      data: { success: true, message: 'No associated account found' },
      status: 200,
    });
  });

  it('3. should throw INVALID_REQUEST when neither logoutToken nor providerAccountId is provided', async () => {
    await expect(
      handleOAuthRevocation({
        c: mockContext as any,
      }),
    ).rejects.toThrowError(AppError);
  });

  it('4. should throw INVALID_REQUEST when logout_token is malformed/invalid JWT', async () => {
    const malformedJwt = 'header.invalid_base64_json_%%%!!!.signature';

    await expect(
      handleOAuthRevocation({
        c: mockContext as any,
        logoutToken: malformedJwt,
      }),
    ).rejects.toThrowError(AppError);
  });

  it('5. should parse valid logout_token JWT with sub claim, infer provider, and perform back-channel logout', async () => {
    // Payload: {"iss":"https://accounts.google.com","sub":"backchannel_sub_456","events":{"http://schemas.openid.net/event/backchannel-logout":{} }}
    const validLogoutToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiJiYWNrY2hhbm5lbF9zdWJfNDU2IiwiZXZlbnRzIjp7Imh0dHA6Ly9zY2hlbWFzLm9wZW5pZC5uZXQvZXZlbnQvYmFja2NoYW5uZWwtbG9nb3V0Ijp7fX19.sig';

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
      logoutToken: validLogoutToken,
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

  it('6. should throw INVALID_REQUEST when logout_token JWT lacks a sub claim', async () => {
    // Payload: {"iss":"https://accounts.google.com","events":{"http://schemas.openid.net/event/backchannel-logout":{} }}
    const logoutTokenNoSub =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJldmVudHMiOnsiaHR0cDovL3NjaGVtYXMub3BlbmlkLm5ldC9ldmVudC9iYWNrY2hhbm5lbC1sb2dvdXQiOnt9fX0.sig';

    await expect(
      handleOAuthRevocation({
        c: mockContext as any,
        logoutToken: logoutTokenNoSub,
      }),
    ).rejects.toThrowError('Missing provider account ID (sub) for revocation');
  });

  it('7. should process revocation cleanly when user has 0 active sessions', async () => {
    vi.mocked(prisma.account.findFirst).mockResolvedValueOnce({
      id: 'acc_789',
      userId: 99,
      provider: 'microsoft',
    } as any);
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.account.delete).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.userSecurityAuditLog.create).mockResolvedValueOnce({} as any);

    const res = await handleOAuthRevocation({
      c: mockContext as any,
      providerAccountId: 'ms_sub_789',
      provider: 'microsoft',
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
});
