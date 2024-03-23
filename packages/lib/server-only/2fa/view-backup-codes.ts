import type { User } from '@documenso/prisma/client';

import { ErrorCode } from '../../next-auth/error-codes';
import { getBackupCodes } from './get-backup-code';
import { validateTwoFactorAuthentication } from './validate-2fa';

type ViewBackupCodesOptions = {
  user: User;
  token: string;
};

export const viewBackupCodes = async ({ token, user }: ViewBackupCodesOptions) => {
  let isValid = await validateTwoFactorAuthentication({ totpCode: token, user });

  if (!isValid) {
    isValid = await validateTwoFactorAuthentication({ backupCode: token, user });
  }

  if (!isValid) {
    throw new Error(ErrorCode.INCORRECT_TWO_FACTOR_CODE);
  }

  const backupCodes = getBackupCodes({ user });

  if (!backupCodes) {
    throw new Error(ErrorCode.MISSING_BACKUP_CODE);
  }

  return backupCodes;
};
