import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZResetTwoFactorRequestSchema,
  ZResetTwoFactorResponseSchema,
} from './reset-two-factor-authentication.types';

export const resetTwoFactorRoute = adminProcedure
  .input(ZResetTwoFactorRequestSchema)
  .output(ZResetTwoFactorResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { userId } = input;

    ctx.logger.info({
      input: {
        userId,
      },
    });

    return await resetTwoFactor({ userId });
  });

export type ResetTwoFactorOptions = {
  userId: number;
};

export const resetTwoFactor = async ({ userId }: ResetTwoFactorOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'User not found' });
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
};
