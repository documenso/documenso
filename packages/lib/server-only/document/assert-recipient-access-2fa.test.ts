import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';
import type { TRecipientAccessAuthTypes } from '../../types/document-auth';
import { createDocumentAuthOptions, createRecipientAuthOptions } from '../../utils/document-auth';
import { generateTwoFactorTokenFromEmail } from '../2fa/email/generate-2fa-token-from-email';
import { generateExternal2FACode } from '../2fa/external-2fa-code';
import { createRateLimit } from '../rate-limit/rate-limit';
import { assertRecipientAccess2FA } from './assert-recipient-access-2fa';

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  audit: vi.fn(),
  user: vi.fn(),
}));

vi.mock('@documenso/prisma', () => ({
  prisma: {
    rateLimit: { upsert: mocks.upsert },
    documentAuditLog: { create: mocks.audit },
    user: { findFirst: mocks.user },
  },
}));
vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../constants/crypto', () => ({ DOCUMENSO_ENCRYPTION_KEY: 'external-2fa-regression-test-key' }));

const envelope = {
  id: 'envelope_2fa_review',
  authOptions: createDocumentAuthOptions({ globalAccessAuth: [], globalActionAuth: [] }),
};

const recipient = (accessAuth: TRecipientAccessAuthTypes[]) => ({
  id: 7,
  envelopeId: envelope.id,
  name: 'Recipient',
  email: 'recipient@example.com',
  authOptions: createRecipientAuthOptions({ accessAuth, actionAuth: [] }),
});

describe('completion access 2FA enforcement', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T12:00:30Z'));
    vi.stubEnv('DANGEROUS_BYPASS_RATE_LIMITS', 'false');
    vi.clearAllMocks();
    const counters = new Map<string, number>();
    mocks.upsert.mockImplementation(({ create }) => {
      const key = `${create.key}|${create.action}|${create.bucket.toISOString()}`;
      const count = (counters.get(key) ?? 0) + create.count;
      counters.set(key, count);
      return Promise.resolve({ count });
    });
    mocks.audit.mockResolvedValue({});
    mocks.user.mockResolvedValue({ id: 42 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each([
    'TWO_FACTOR_AUTH',
    'EXTERNAL_TWO_FACTOR_AUTH',
  ] as const)('rejects ACCOUNT as the second factor when ACCOUNT and %s are configured', async (method) => {
    await expect(
      assertRecipientAccess2FA({
        envelope,
        recipient: recipient(['ACCOUNT', method]),
        userId: 42,
        accessAuthOptions: { type: 'ACCOUNT' },
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.TWO_FACTOR_AUTH_FAILED });
    expect(mocks.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'DOCUMENT_ACCESS_AUTH_2FA_FAILED' }),
    });
  });

  it('accepts an external code with ACCOUNT also configured', async () => {
    const { code } = await generateExternal2FACode({ envelopeId: envelope.id, recipientId: 7 });
    await expect(
      assertRecipientAccess2FA({
        envelope,
        recipient: recipient(['ACCOUNT', 'EXTERNAL_TWO_FACTOR_AUTH']),
        accessAuthOptions: { type: 'EXTERNAL_TWO_FACTOR_AUTH', token: code },
      }),
    ).resolves.toBeUndefined();
  });

  it('preserves both code choices when email and external 2FA are configured', async () => {
    const target = recipient(['TWO_FACTOR_AUTH', 'EXTERNAL_TWO_FACTOR_AUTH']);
    const { code } = await generateExternal2FACode({ envelopeId: envelope.id, recipientId: 7 });
    const emailCode = await generateTwoFactorTokenFromEmail({ envelopeId: envelope.id, email: target.email });
    await assertRecipientAccess2FA({
      envelope,
      recipient: target,
      accessAuthOptions: { type: 'TWO_FACTOR_AUTH', method: 'email', token: emailCode },
    });
    await assertRecipientAccess2FA({
      envelope,
      recipient: target,
      accessAuthOptions: { type: 'EXTERNAL_TWO_FACTOR_AUTH', token: code },
    });
  });

  it('shares the recipient budget across IPs and code methods and resets at the fixed bucket boundary', async () => {
    const target = recipient(['TWO_FACTOR_AUTH', 'EXTERNAL_TWO_FACTOR_AUTH']);
    const { code } = await generateExternal2FACode({ envelopeId: envelope.id, recipientId: 7 });
    const wrongCode = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(
        assertRecipientAccess2FA({
          envelope,
          recipient: target,
          requestMetadata: { ipAddress: `test-ip-${attempt}` },
          accessAuthOptions: { type: 'EXTERNAL_TWO_FACTOR_AUTH', token: wrongCode },
        }),
      ).rejects.toMatchObject({ code: AppErrorCode.TWO_FACTOR_AUTH_FAILED });
    }
    const emailCode = await generateTwoFactorTokenFromEmail({ envelopeId: envelope.id, email: target.email });
    await expect(
      assertRecipientAccess2FA({
        envelope,
        recipient: target,
        requestMetadata: { ipAddress: 'another-ip' },
        accessAuthOptions: { type: 'TWO_FACTOR_AUTH', method: 'email', token: emailCode },
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.TOO_MANY_REQUESTS });
    expect(mocks.audit).toHaveBeenCalledTimes(5);
    vi.setSystemTime(new Date('2026-01-01T12:15:00Z'));
    const fresh = await generateExternal2FACode({ envelopeId: envelope.id, recipientId: 7 });
    await assertRecipientAccess2FA({
      envelope,
      recipient: target,
      accessAuthOptions: { type: 'EXTERNAL_TWO_FACTOR_AUTH', token: fresh.code },
    });
  });

  it.each([1, 2])('does not verify a code if rate counter write %s fails', async (failedWrite) => {
    if (failedWrite === 1) {
      mocks.upsert.mockRejectedValueOnce(new Error('counter unavailable'));
    } else {
      mocks.upsert.mockResolvedValueOnce({ count: 1 }).mockRejectedValueOnce(new Error('counter unavailable'));
    }
    const { code } = await generateExternal2FACode({ envelopeId: envelope.id, recipientId: 7 });
    await expect(
      assertRecipientAccess2FA({
        envelope,
        recipient: recipient(['EXTERNAL_TWO_FACTOR_AUTH']),
        accessAuthOptions: { type: 'EXTERNAL_TWO_FACTOR_AUTH', token: code },
      }),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('enforces the shared 50-attempt IP limit across recipients', async () => {
    for (let id = 1; id <= 50; id++) {
      await expect(
        assertRecipientAccess2FA({
          envelope,
          recipient: { ...recipient(['ACCOUNT', 'EXTERNAL_TWO_FACTOR_AUTH']), id },
          userId: 42,
          requestMetadata: { ipAddress: 'shared-ip' },
          accessAuthOptions: { type: 'ACCOUNT' },
        }),
      ).rejects.toMatchObject({ code: AppErrorCode.TWO_FACTOR_AUTH_FAILED });
    }
    await expect(
      assertRecipientAccess2FA({
        envelope,
        recipient: { ...recipient(['EXTERNAL_TWO_FACTOR_AUTH']), id: 51 },
        requestMetadata: { ipAddress: 'shared-ip' },
        accessAuthOptions: { type: 'EXTERNAL_TWO_FACTOR_AUTH', token: '000000' },
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.TOO_MANY_REQUESTS });
    expect(mocks.audit).toHaveBeenCalledTimes(50);
  });

  it('keeps unrelated rate limiters fail-open by default', async () => {
    mocks.upsert.mockRejectedValueOnce(new Error('counter unavailable'));
    const limiter = createRateLimit({ action: 'test.other-action', max: 5, window: '15m' });
    await expect(limiter.check({ ip: 'test-ip' })).resolves.toMatchObject({ isLimited: false });
  });

  it('leaves account-only completion outside the code limiter', async () => {
    await assertRecipientAccess2FA({ envelope, recipient: recipient(['ACCOUNT']), userId: 42 });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('rejects missing codes before audit or verification, including unsupported embedded callers', async () => {
    await expect(
      assertRecipientAccess2FA({ envelope, recipient: recipient(['EXTERNAL_TWO_FACTOR_AUTH']) }),
    ).rejects.toMatchObject({ code: AppErrorCode.UNAUTHORIZED });
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
