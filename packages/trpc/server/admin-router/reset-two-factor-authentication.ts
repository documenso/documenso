import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZReset2FARequestSchema,
  ZReset2FAResponseSchema,
} from './reset-two-factor-authentication.types';

export const reset2FARoute = adminProcedure
  .input(ZReset2FARequestSchema)
  .output(ZReset2FAResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    return await reset2FA({ id });
  });

export type Reset2FAOptions = {
  id: number;
};

export const reset2FA = async ({ id }: Reset2FAOptions) => {
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
