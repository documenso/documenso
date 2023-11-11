import { User } from '@documenso/prisma/client';

import { ErrorCode } from '../../next-auth/error-codes';
import { verifyTwoFactor } from './verify-2fa';
import { verifyBackupCode } from './verify-backup-code';

type authenticateTwoFactorAuthParams = {
  totpCode?: string;
  backupCode?: string;
  user: User;
};

export const authenticateTwoFactorAuth = async ({
  backupCode,
  totpCode,
  user,
}: authenticateTwoFactorAuthParams) => {
  if (!backupCode && !totpCode) {
    throw new Error(ErrorCode.TWO_FACTOR_MISSING_CREDENTIALS);
  }

  if (!user.twoFactorEnabled) {
    throw new Error(ErrorCode.TWO_FACTOR_SETUP_REQUIRED);
  }

  if (!user.twoFactorSecret) {
    throw new Error(ErrorCode.TWO_FACTOR_MISSING_SECRET);
  }

  if (user.identityProvider !== 'DOCUMENSO') {
    throw new Error(ErrorCode.INCORRECT_IDENTITY_PROVIDER);
  }

  if (totpCode) {
    const isValidToken = await verifyTwoFactor({ user, totpCode });

    if (!isValidToken) {
      throw new Error(ErrorCode.INCORRECT_TWO_FACTOR_CODE);
    }
  } else {
    if (!backupCode) {
      throw new Error(ErrorCode.MISSING_BACKUP_CODE);
    }

    const isBackupCodeValid = verifyBackupCode({ user, backupCode });

    if (!isBackupCodeValid) {
      throw new Error(ErrorCode.INCORRECT_TWO_FACTOR_BACKUP_CODE);
    }
  }
};
