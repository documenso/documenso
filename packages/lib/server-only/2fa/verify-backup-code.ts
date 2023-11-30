import { User } from '@documenso/prisma/client';

import { getBackupCodes } from './get-backup-code';

type VerifyBackupCodeParams = {
  user: User;
  backupCode: string;
};

export const verifyBackupCode = async ({ user, backupCode }: VerifyBackupCodeParams) => {
  const userBackupCodes = await getBackupCodes({ user });

  if (!userBackupCodes) {
    throw new Error('User has no backup codes');
  }

  return userBackupCodes.includes(backupCode);
};
