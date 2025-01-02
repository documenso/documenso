import type { User } from '@prisma/client';

import { AppError } from '../../errors/app-error';
import { getBackupCodes } from './get-backup-code';
import { validateTwoFactorAuthentication } from './validate-2fa';

type ViewBackupCodesOptions = {
  user: Pick<
    User,
    'id' | 'email' | 'twoFactorEnabled' | 'twoFactorSecret' | 'twoFactorBackupCodes'
  >;
  token: string;
};

export const viewBackupCodes = async ({ token, user }: ViewBackupCodesOptions) => {
  let isValid = await validateTwoFactorAuthentication({ totpCode: token, user });

  if (!isValid) {
    isValid = await validateTwoFactorAuthentication({ backupCode: token, user });
  }

  if (!isValid) {
    throw new AppError('INCORRECT_TWO_FACTOR_CODE');
  }

  const backupCodes = getBackupCodes({ user });

  if (!backupCodes) {
    throw new AppError('MISSING_BACKUP_CODE');
  }

  return backupCodes;
};
