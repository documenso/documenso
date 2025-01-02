import type { User } from '@prisma/client';

import { getBackupCodes } from './get-backup-code';

type VerifyBackupCodeParams = {
  user: Pick<User, 'id' | 'email' | 'twoFactorEnabled' | 'twoFactorBackupCodes'>;
  backupCode: string;
};

export const verifyBackupCode = async ({ user, backupCode }: VerifyBackupCodeParams) => {
  const userBackupCodes = await getBackupCodes({ user });

  if (!userBackupCodes) {
    throw new Error('User has no backup codes');
  }

  return userBackupCodes.includes(backupCode);
};
