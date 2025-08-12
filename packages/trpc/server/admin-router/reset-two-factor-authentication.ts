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
    const { id } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    return await resetTwoFactor({ id });
  });

export type ResetTwoFactorOptions = {
  id: number;
};

export const resetTwoFactor = async ({ id }: ResetTwoFactorOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      id,
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
