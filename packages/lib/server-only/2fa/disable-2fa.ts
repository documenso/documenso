import { compare } from 'bcrypt';

import { prisma } from '@documenso/prisma';
import { User } from '@documenso/prisma/client';

import { ErrorCode } from '../../next-auth/error-codes';
import { validateTwoFactorAuthentication } from './validate-2fa';

type DisableTwoFactorAuthenticationOptions = {
  user: User;
  backupCode: string;
  password: string;
};

export const disableTwoFactorAuthentication = async ({
  backupCode,
  user,
  password,
}: DisableTwoFactorAuthenticationOptions) => {
  if (!user.password) {
    throw new Error(ErrorCode.USER_MISSING_PASSWORD);
  }

  const isCorrectPassword = await compare(password, user.password);

  if (!isCorrectPassword) {
    throw new Error(ErrorCode.INCORRECT_PASSWORD);
  }

  const isValid = await validateTwoFactorAuthentication({ backupCode, user });

  if (!isValid) {
    throw new Error(ErrorCode.INCORRECT_TWO_FACTOR_BACKUP_CODE);
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      twoFactorEnabled: false,
      twoFactorBackupCodes: null,
      twoFactorSecret: null,
    },
  });

  return true;
};
