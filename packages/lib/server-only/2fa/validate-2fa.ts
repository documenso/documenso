import type { User } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { verifyTwoFactorAuthenticationToken } from './verify-2fa-token';
import { verifyBackupCode } from './verify-backup-code';

type ValidateTwoFactorAuthenticationOptions = {
  totpCode?: string;
  backupCode?: string;
  user: Pick<User, 'id' | 'email' | 'twoFactorEnabled' | 'twoFactorSecret' | 'twoFactorBackupCodes'>;
};

export type TTwoFactorAuthenticationMethod = 'totp' | 'backup';

export type TValidateTwoFactorAuthenticationResult =
  | { isValid: true; method: TTwoFactorAuthenticationMethod }
  | { isValid: false; method: null };

export const validateTwoFactorAuthentication = async ({
  backupCode,
  totpCode,
  user,
}: ValidateTwoFactorAuthenticationOptions): Promise<TValidateTwoFactorAuthenticationResult> => {
  if (!user.twoFactorEnabled) {
    throw new AppError(AppErrorCode.TWO_FACTOR_SETUP_REQUIRED);
  }

  if (!user.twoFactorSecret) {
    throw new AppError(AppErrorCode.TWO_FACTOR_MISSING_SECRET);
  }

  if (totpCode) {
    const isValid = await verifyTwoFactorAuthenticationToken({ user, totpCode });

    return isValid ? { isValid: true, method: 'totp' } : { isValid: false, method: null };
  }

  if (backupCode) {
    const isValid = verifyBackupCode({ user, backupCode });

    return isValid ? { isValid: true, method: 'backup' } : { isValid: false, method: null };
  }

  throw new AppError(AppErrorCode.TWO_FACTOR_MISSING_CREDENTIALS);
};
