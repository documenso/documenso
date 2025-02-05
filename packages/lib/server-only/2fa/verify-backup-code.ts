import type { User } from '@prisma/client';

import { getBackupCodes } from './get-backup-code';

type VerifyBackupCodeParams = {
  user: Pick<User, 'id' | 'twoFactorEnabled' | 'twoFactorBackupCodes'>;
  backupCode: string;
};

export const verifyBackupCode = ({ user, backupCode }: VerifyBackupCodeParams) => {
  const userBackupCodes = getBackupCodes({ user });

  if (!userBackupCodes) {
    throw new Error('User has no backup codes');
  }

  return userBackupCodes.includes(backupCode);
};
