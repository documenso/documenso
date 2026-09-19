import { prisma } from '@documenso/prisma';
import crypto from 'crypto';

import { ONE_HOUR } from '../../constants/time';
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

  const token = crypto.randomBytes(18).toString('hex');

  // Invalidate any prior reset tokens for this user before issuing a new one, so
  // only a single token is ever live at a time. We still always issue a fresh
  // token (and email) so the user can request a new link if a prior email never
  // arrived, while bounding the number of usable tokens to one.
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await tx.passwordResetToken.create({
      data: {
        token,
        expiry: new Date(Date.now() + ONE_HOUR),
        userId: user.id,
      },
    });
  });

  await sendForgotPassword({
    userId: user.id,
  }).catch((err) => console.error(err));
};
