import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDocumentAuthOptions, createRecipientAuthOptions } from '../../utils/document-auth';
import { isRecipientAuthorized } from '../document/is-recipient-authorized';
import { generateTwoFactorTokenFromEmail } from './email/generate-2fa-token-from-email';
import { generateExternal2FACode } from './external-2fa-code';

const recipient = {
  id: 7,
  envelopeId: 'envelope_external2fatest',
  email: 'recipient@example.com',
  authOptions: createRecipientAuthOptions({ accessAuth: ['EXTERNAL_TWO_FACTOR_AUTH'], actionAuth: [] }),
};

const documentAuthOptions = createDocumentAuthOptions({ globalAccessAuth: [], globalActionAuth: [] });

const checkCode = async (token: string, target = recipient) =>
  await isRecipientAuthorized({
    type: 'ACCESS_2FA',
    documentAuthOptions,
    recipient: target,
    authOptions: { type: 'EXTERNAL_TWO_FACTOR_AUTH', token },
  });

describe('external 2FA code', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T12:00:30.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts the issued code and rejects a different code', async () => {
    const { code } = await generateExternal2FACode({ envelopeId: recipient.envelopeId, recipientId: recipient.id });
    const otherCode = String((Number(code) + 1) % 1_000_000).padStart(6, '0');

    expect(code).toMatch(/^\d{6}$/);
    expect(await checkCode(code)).toBe(true);
    expect(await checkCode(otherCode)).toBe(false);
  });

  it('accepts the code until 1 ms before expiresAt and rejects it at expiresAt', async () => {
    const { code, expiresAt } = await generateExternal2FACode({
      envelopeId: recipient.envelopeId,
      recipientId: recipient.id,
    });

    // Issued in the 12:00 minute, valid for 10 periods of 60 s.
    expect(expiresAt.toISOString()).toBe('2026-01-01T12:10:00.000Z');

    vi.setSystemTime(new Date('2026-01-01T12:09:59.999Z'));
    expect(await checkCode(code)).toBe(true);

    vi.setSystemTime(new Date('2026-01-01T12:10:00.000Z'));
    expect(await checkCode(code)).toBe(false);
  });

  it('rejects an email 2FA code for a recipient that only has external 2FA', async () => {
    const emailCode = await generateTwoFactorTokenFromEmail({
      envelopeId: recipient.envelopeId,
      email: recipient.email,
    });

    const authorized = await isRecipientAuthorized({
      type: 'ACCESS_2FA',
      documentAuthOptions,
      recipient,
      authOptions: { type: 'TWO_FACTOR_AUTH', method: 'email', token: emailCode },
    });

    expect(authorized).toBe(false);
  });

  it('rejects the code of one recipient for another recipient', async () => {
    const { code } = await generateExternal2FACode({ envelopeId: recipient.envelopeId, recipientId: recipient.id });

    expect(await checkCode(code, { ...recipient, id: 8 })).toBe(false);
  });
});
