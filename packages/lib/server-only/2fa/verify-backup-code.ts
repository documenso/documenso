import { User } from '@documenso/prisma/client';

import { getBackupCodes } from './get-backup-code';

type VerifyBackupCodeParams = {
  user: User;
  backupCode: string;
};

export const verifyBackupCode = ({ user, backupCode }: VerifyBackupCodeParams) => {
  const userBackupCodes = getBackupCodes({ user });

  if (!userBackupCodes) {
    throw new Error('user missing 2fa backup code');
  }

  const formattedBackupCode = userBackupCodes.join('\n');

  return formattedBackupCode === backupCode;
};
