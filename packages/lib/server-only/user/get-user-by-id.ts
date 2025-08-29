import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface GetUserByIdOptions {
  id: number;
}

export const getUserById = async ({ id }: GetUserByIdOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      roles: true,
      disabled: true,
      twoFactorEnabled: true,
      signature: true,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  return user;
};
