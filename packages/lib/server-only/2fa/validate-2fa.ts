import type { User } from '@prisma/client';

import { AppError } from '../../errors/app-error';
import { verifyTwoFactorAuthenticationToken } from './verify-2fa-token';
import { verifyBackupCode } from './verify-backup-code';

type ValidateTwoFactorAuthenticationOptions = {
  totpCode?: string;
  backupCode?: string;
  user: Pick<
    User,
    'id' | 'email' | 'twoFactorEnabled' | 'twoFactorSecret' | 'twoFactorBackupCodes'
  >;
};

export const validateTwoFactorAuthentication = async ({
  backupCode,
  totpCode,
  user,
}: ValidateTwoFactorAuthenticationOptions) => {
  if (!user.twoFactorEnabled) {
    throw new AppError('TWO_FACTOR_SETUP_REQUIRED');
  }

  if (!user.twoFactorSecret) {
    throw new AppError('TWO_FACTOR_MISSING_SECRET');
  }

  if (totpCode) {
    return await verifyTwoFactorAuthenticationToken({ user, totpCode });
  }

  if (backupCode) {
    return verifyBackupCode({ user, backupCode });
  }

  throw new AppError('TWO_FACTOR_MISSING_CREDENTIALS');
};
