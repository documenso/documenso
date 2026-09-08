import { base32 } from '@scure/base';
import crypto from 'crypto';
import { generateHOTP } from 'oslo/otp';
import { describe, expect, it } from 'vitest';

import { AppError } from '../../errors/app-error';
import { symmetricEncrypt } from '../../universal/crypto';

// `DOCUMENSO_ENCRYPTION_KEY` is captured at module load, so the env var must
// be set before `validate-2fa` (via `verify-2fa-token`/`verify-backup-code`)
// is imported. This is real environment configuration, not a mock — the code
// under test performs no I/O.
process.env.NEXT_PRIVATE_ENCRYPTION_KEY ??= 'test-encryption-key';

const ENCRYPTION_KEY = process.env.NEXT_PRIVATE_ENCRYPTION_KEY ?? 'test-encryption-key';

const { validateTwoFactorAuthentication } = await import('./validate-2fa');

const BACKUP_CODES = ['AAAAA-AAAAA', 'BBBBB-BBBBB'];

const createUser = (overrides: Partial<Parameters<typeof validateTwoFactorAuthentication>[0]['user']> = {}) => {
  const secret = crypto.randomBytes(10);
  const encodedSecret = base32.encode(new Uint8Array(secret));

  return {
    user: {
      id: 1,
      email: 'user@example.com',
      twoFactorEnabled: true,
      twoFactorSecret: symmetricEncrypt({ data: encodedSecret, key: ENCRYPTION_KEY }),
      twoFactorBackupCodes: symmetricEncrypt({ data: JSON.stringify(BACKUP_CODES), key: ENCRYPTION_KEY }),
      ...overrides,
    },
    secret,
  };
};

const generateCurrentTotpCode = async (secret: Buffer) => {
  const counter = Math.floor(Date.now() / 30_000);

  return await generateHOTP(new Uint8Array(secret), counter);
};

describe('validateTwoFactorAuthentication', () => {
  it('returns method totp for a valid TOTP code', async () => {
    const { user, secret } = createUser();

    const totpCode = await generateCurrentTotpCode(secret);

    await expect(validateTwoFactorAuthentication({ totpCode, user })).resolves.toEqual({
      isValid: true,
      method: 'totp',
    });
  });

  it('returns invalid for an incorrect TOTP code', async () => {
    const { user, secret } = createUser();

    const validCode = await generateCurrentTotpCode(secret);
    const invalidCode = validCode === '000000' ? '000001' : '000000';

    await expect(validateTwoFactorAuthentication({ totpCode: invalidCode, user })).resolves.toEqual({
      isValid: false,
      method: null,
    });
  });

  it('returns method backup for a valid backup code', async () => {
    const { user } = createUser();

    await expect(validateTwoFactorAuthentication({ backupCode: BACKUP_CODES[0], user })).resolves.toEqual({
      isValid: true,
      method: 'backup',
    });
  });

  it('returns invalid for an unknown backup code', async () => {
    const { user } = createUser();

    await expect(validateTwoFactorAuthentication({ backupCode: 'ZZZZZ-ZZZZZ', user })).resolves.toEqual({
      isValid: false,
      method: null,
    });
  });

  it('prefers the TOTP code when both credentials are provided', async () => {
    const { user, secret } = createUser();

    const totpCode = await generateCurrentTotpCode(secret);

    await expect(validateTwoFactorAuthentication({ totpCode, backupCode: BACKUP_CODES[0], user })).resolves.toEqual({
      isValid: true,
      method: 'totp',
    });
  });

  it('throws when 2FA is not enabled', async () => {
    const { user } = createUser({ twoFactorEnabled: false });

    await expect(validateTwoFactorAuthentication({ totpCode: '000000', user })).rejects.toThrowError(AppError);
  });

  it('throws when no credentials are provided', async () => {
    const { user } = createUser();

    await expect(validateTwoFactorAuthentication({ user })).rejects.toThrowError(AppError);
  });
});
