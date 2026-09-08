import type { User } from '@prisma/client';

import { AppError } from '../../errors/app-error';
import { verifyTwoFactorAuthenticationToken } from './verify-2fa-token';
import { verifyBackupCode } from './verify-backup-code';

type ValidateTwoFactorAuthenticationOptions = {
  totpCode?: string;
  backupCode?: string;
  user: Pick<User, 'id' | 'email' | 'twoFactorEnabled' | 'twoFactorSecret' | 'twoFactorBackupCodes'>;
};

export type TTwoFactorAuthenticationMethod = 'totp' | 'backup';

/**
 * Discriminates which second factor matched so callers can treat backup codes
 * as recovery (which resets 2FA) rather than a regular sign-in factor.
 */
export type TValidateTwoFactorAuthenticationResult =
  | { isValid: true; method: TTwoFactorAuthenticationMethod }
  | { isValid: false; method: null };

export const validateTwoFactorAuthentication = async ({
  backupCode,
  totpCode,
  user,
}: ValidateTwoFactorAuthenticationOptions): Promise<TValidateTwoFactorAuthenticationResult> => {
  if (!user.twoFactorEnabled) {
    throw new AppError('TWO_FACTOR_SETUP_REQUIRED');
  }

  if (!user.twoFactorSecret) {
    throw new AppError('TWO_FACTOR_MISSING_SECRET');
  }

  if (totpCode) {
    const isValid = await verifyTwoFactorAuthenticationToken({ user, totpCode });

    return isValid ? { isValid: true, method: 'totp' } : { isValid: false, method: null };
  }

  if (backupCode) {
    const isValid = verifyBackupCode({ user, backupCode });

    return isValid ? { isValid: true, method: 'backup' } : { isValid: false, method: null };
  }

  throw new AppError('TWO_FACTOR_MISSING_CREDENTIALS');
};
