import { compare, hash } from '@node-rs/bcrypt';
import { UserSecurityAuditLogType } from '@prisma/client';

import { SALT_ROUNDS } from '@documenso/lib/constants/auth';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';

export type UpdatePasswordOptions = {
  userId: number;
  password: string;
  currentPassword: string;
  requestMetadata?: RequestMetadata;
};

export const updatePassword = async ({
  userId,
  password,
  currentPassword,
  requestMetadata,
}: UpdatePasswordOptions) => {
  // Existence check
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  if (!user.password) {
    throw new AppError('NO_PASSWORD');
  }

  const isCurrentPasswordValid = await compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw new AppError('INCORRECT_PASSWORD');
  }

  // Compare the new password with the old password
  const isSamePassword = await compare(password, user.password);
  if (isSamePassword) {
    throw new AppError('SAME_PASSWORD');
  }

  const hashedNewPassword = await hash(password, SALT_ROUNDS);

  return await prisma.$transaction(async (tx) => {
    await tx.userSecurityAuditLog.create({
      data: {
        userId,
        type: UserSecurityAuditLogType.PASSWORD_UPDATE,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    });

    return await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hashedNewPassword,
      },
    });
  });
};
