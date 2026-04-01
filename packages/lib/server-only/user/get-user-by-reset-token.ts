import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface GetUserByResetTokenOptions {
  token: string;
}

export const getUserByResetToken = async ({ token }: GetUserByResetTokenOptions) => {
  const result = await prisma.passwordResetToken.findFirst({
    where: {
      token,
    },
    include: {
      user: true,
    },
  });

  if (!result || !result.user) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  return result.user;
};
