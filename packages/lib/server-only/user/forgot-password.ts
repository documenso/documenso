import crypto from 'crypto';

import { prisma } from '@documenso/prisma';
import { TForgotPasswordFormSchema } from '@documenso/trpc/server/profile-router/schema';

export const forgotPassword = async ({ email }: TForgotPasswordFormSchema) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (!user) {
    throw new Error('A password reset email has been sent.');
  }

  const existingToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      createdAt: {
        gte: new Date(Date.now() - 1000 * 60 * 60),
      },
    },
  });

  if (existingToken) {
    throw new Error('A password reset email has been sent.');
  }

  const token = crypto.randomBytes(64).toString('hex');
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24); // Set expiry to one hour from now

  let passwordResetToken;

  try {
    passwordResetToken = await prisma.passwordResetToken.create({
      data: {
        token,
        expiry,
        userId: user.id,
      },
    });
  } catch (error) {
    throw new Error('Something went wrong');
  }

  console.log('Password reset token: ', passwordResetToken);
  // send an email to user with password token

  return passwordResetToken;
};
