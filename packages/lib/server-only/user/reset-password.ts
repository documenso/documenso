import { compare, hash } from '@node-rs/bcrypt';
import { UserSecurityAuditLogType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { SALT_ROUNDS } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobsClient } from '../../jobs/client';
import type { RequestMetadata } from '../../universal/extract-request-metadata';

export type ResetPasswordOptions = {
  token: string;
  password: string;
  requestMetadata?: RequestMetadata;
};

export const resetPassword = async ({ token, password, requestMetadata }: ResetPasswordOptions) => {
  if (!token) {
    throw new AppError('INVALID_TOKEN');
  }

  const foundToken = await prisma.passwordResetToken.findFirst({
    where: {
      token,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
        },
      },
    },
  });

  if (!foundToken) {
    throw new AppError('INVALID_TOKEN');
  }

  const now = new Date();

  if (now > foundToken.expiry) {
    throw new AppError(AppErrorCode.EXPIRED_CODE);
  }

  const isSamePassword = await compare(password, foundToken.user.password || '');

  if (isSamePassword) {
    throw new AppError('SAME_PASSWORD');
  }

  const hashedPassword = await hash(password, SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: foundToken.userId,
      },
      data: {
        password: hashedPassword,
      },
    });

    await tx.passwordResetToken.deleteMany({
      where: {
        userId: foundToken.userId,
      },
    });

    await tx.userSecurityAuditLog.create({
      data: {
        userId: foundToken.userId,
        type: UserSecurityAuditLogType.PASSWORD_RESET,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });

    await jobsClient.triggerJob({
      name: 'send.password.reset.success.email',
      payload: {
        userId: foundToken.userId,
      },
    });
  });

  return {
    userId: foundToken.userId,
  };
};
