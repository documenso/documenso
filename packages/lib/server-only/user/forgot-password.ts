import crypto from 'crypto';

import { prisma } from '@documenso/prisma';

import { ONE_DAY } from '../../constants/time';
import { sendForgotPassword } from '../auth/send-forgot-password';

export const forgotPassword = async ({ email }: { email: string }) => {
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
  });

  if (!user) {
    return;
  }

  // Find a token that was created in the last hour and hasn't expired
  // const existingToken = await prisma.passwordResetToken.findFirst({
  //   where: {
  //     userId: user.id,
  //     expiry: {
  //       gt: new Date(),
  //     },
  //     createdAt: {
  //       gt: new Date(Date.now() - ONE_HOUR),
  //     },
  //   },
  // });

  // if (existingToken) {
  //   return;
  // }

  const token = crypto.randomBytes(18).toString('hex');

  await prisma.passwordResetToken.create({
    data: {
      token,
      expiry: new Date(Date.now() + ONE_DAY),
      userId: user.id,
    },
  });

  await sendForgotPassword({
    userId: user.id,
  }).catch((err) => console.error(err));
};
