import { compare, hash } from 'bcrypt';

import { prisma } from '@documenso/prisma';

import { SALT_ROUNDS } from '../../constants/auth';
import { sendResetPassword } from '../auth/send-reset-password';

export type ResetPasswordOptions = {
  token: string;
  password: string;
};

export const resetPassword = async ({ token, password }: ResetPasswordOptions) => {
  if (!token) {
    throw new Error('Invalid Token');
  }

  const foundToken = await prisma.passwordResetToken.findFirstOrThrow({
    where: {
      token,
    },
    include: {
      User: true,
    },
  });

  if (!foundToken) {
    throw new Error('Invalid Token');
  }

  const now = new Date();

  if (now > foundToken.expiry) {
    throw new Error('Token has expired');
  }

  const isSamePassword = await compare(password, foundToken.User.password!);

  if (isSamePassword) {
    throw new Error('Your new password cannot be the same as your old password.');
  }

  const hashedPassword = await hash(password, SALT_ROUNDS);

  const transactions = await prisma.$transaction([
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
  ]);

  if (!transactions) {
    throw new Error('Unable to update password');
  }

  await sendResetPassword({ userId: foundToken.userId });
  return transactions;
};
