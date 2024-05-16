import { compare, hash } from '@node-rs/bcrypt';

import { prisma } from '@documenso/prisma';
import { UserSecurityAuditLogType } from '@documenso/prisma/client';

import { SALT_ROUNDS } from '../../constants/auth';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { sendResetPassword } from '../auth/send-reset-password';

export type ResetPasswordOptions = {
  token: string;
  password: string;
  requestMetadata?: RequestMetadata;
};

export const resetPassword = async ({ token, password, requestMetadata }: ResetPasswordOptions) => {
  if (!token) {
    throw new Error('ტოკენი არასწორი. გთხოვთ თავიდან სცადეთ.');
  }

  const foundToken = await prisma.passwordResetToken.findFirst({
    where: {
      token,
    },
    include: {
      User: true,
    },
  });

  if (!foundToken) {
    throw new Error('ტოკენი არასწორი. გთხოვთ თავიდან სცადეთ.');
  }

  const now = new Date();

  if (now > foundToken.expiry) {
    throw new Error('ტოკენს ვადა გაუვიდა. გთხოვთ თავიდან სცადეთ.');
  }

  const isSamePassword = await compare(password, foundToken.User.password || '');

  if (isSamePassword) {
    throw new Error('თქვენი ახალი პაროლი არ შეიძლება ემთხვეოდეს ძველი პაროლის.');
  }

  const hashedPassword = await hash(password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: foundToken.userId,
      },
      data: {
        password: hashedPassword,
      },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: foundToken.userId,
      },
    }),
    prisma.userSecurityAuditLog.create({
      data: {
        userId: foundToken.userId,
        type: UserSecurityAuditLogType.PASSWORD_RESET,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    }),
  ]);

  await sendResetPassword({ userId: foundToken.userId });
};
