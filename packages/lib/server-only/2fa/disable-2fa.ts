import { TRPCError } from '@trpc/server';
import { compare } from 'bcrypt';

import { prisma } from '@documenso/prisma';
import { User } from '@documenso/prisma/client';

import { ErrorCode } from '../../next-auth/error-codes';
import { authenticateTwoFactorAuth } from './authenticate-2fa';

type disableTwoFactorAuthenticationProps = {
  user: User;
  code?: string;
  backupCode?: string;
  password: string;
};

export const disableTwoFactorAuthentication = async ({
  code,
  backupCode,
  user,
  password,
}: disableTwoFactorAuthenticationProps) => {
  if (!user.password) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: ErrorCode.USER_MISSING_PASSWORD,
    });
  }

  const isCorrectPassword = await compare(password, user.password);

  if (!isCorrectPassword) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: ErrorCode.INCORRECT_PASSWORD,
    });
  }

  try {
    await authenticateTwoFactorAuth({ backupCode, totpCode: code, user });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: error?.message,
    });
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

  return { message: '2fa disabled successfully' };
};
