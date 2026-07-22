import { describe, expect, it, vi } from 'vitest';

import { handleOAuthRevocation } from './handle-oauth-revocation';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    account: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'acc_123',
        userId: 42,
        provider: 'google',
      }),
      delete: vi.fn().mockResolvedValue({}),
    },
    session: {
      findMany: vi.fn().mockResolvedValue([{ id: 'sess_1' }, { id: 'sess_2' }]),
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    userSecurityAuditLog: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    $transaction: vi.fn().mockImplementation((cb) => cb(prisma)),
  },
}));

describe('OAuth Access Revocation Handler', () => {
  it('should invalidate active sessions and remove account link when providerAccountId is supplied', async () => {
    const mockContext = {
      get: vi.fn().mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'Jest-Test' }),
      json: vi.fn().mockImplementation((data, status) => ({ data, status })),
    };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const res = await handleOAuthRevocation({
      c: mockContext as any,
      providerAccountId: 'google_user_sub_99',
      provider: 'google',
    });

    expect(res).toEqual({
      data: { success: true, message: 'OAuth access revoked and sessions terminated' },
      status: 200,
    });
  });
});
