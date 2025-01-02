import type { User } from '@prisma/client';

import { ErrorCode } from '../../next-auth/error-codes';
import { verifyTwoFactorAuthenticationToken } from './verify-2fa-token';
import { verifyBackupCode } from './verify-backup-code';

type ValidateTwoFactorAuthenticationOptions = {
  totpCode?: string;
  backupCode?: string;
  user: Pick<User, 'id' | 'email' | 'twoFactorEnabled' | 'twoFactorSecret'>;
};

export const validateTwoFactorAuthentication = async ({
  backupCode,
  totpCode,
  user,
}: ValidateTwoFactorAuthenticationOptions) => {
  if (!user.twoFactorEnabled) {
    throw new Error(ErrorCode.TWO_FACTOR_SETUP_REQUIRED);
  }

  if (!user.twoFactorSecret) {
    throw new Error(ErrorCode.TWO_FACTOR_MISSING_SECRET);
  }

  if (totpCode) {
    return await verifyTwoFactorAuthenticationToken({ user, totpCode });
  }

  if (backupCode) {
    return await verifyBackupCode({ user, backupCode });
  }

  throw new Error(ErrorCode.TWO_FACTOR_MISSING_CREDENTIALS);
};
