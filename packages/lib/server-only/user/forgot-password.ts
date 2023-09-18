import crypto from 'crypto';

import { prisma } from '@documenso/prisma';
import { TForgotPasswordFormSchema } from '@documenso/trpc/server/profile-router/schema';

import { sendForgotPassword } from '../auth/send-forgot-password';

export const forgotPassword = async ({ email }: TForgotPasswordFormSchema) => {
  let user;
  try {
    user = await prisma.user.findFirstOrThrow({
      where: {
        email: email.toLowerCase(),
      },
    });
  } catch (error) {
    throw new Error('No account found with that email address.');
  }

  if (!user) {
    throw new Error('No account found with that email address.');
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

  try {
    await prisma.passwordResetToken.create({
      data: {
        token,
        expiry,
        userId: user.id,
      },
    });
  } catch (error) {
    throw new Error('We were unable to send your email. Please try again.');
  }

  return await sendForgotPassword({
    userId: user.id,
  });
};
