import crypto from 'crypto';

import { prisma } from '@documenso/prisma';

import { ONE_HOUR } from '../../constants/time';
import { sendConfirmationEmail } from '../auth/send-confirmation-email';

const IDENTIFIER = 'confirmation-email';

export const generateConfirmationToken = async ({ email }: { email: string }) => {
  const token = crypto.randomBytes(20).toString('hex');

  const user = await prisma.user.findFirst({
    where: {
      email: email,
    },
  });

  if (!user) {
    throw new Error('მომხმარებელი არ მოიძებნა');
  }

  const createdToken = await prisma.verificationToken.create({
    data: {
      identifier: IDENTIFIER,
      token: token,
      expires: new Date(Date.now() + ONE_HOUR),
      user: {
        connect: {
          id: user.id,
        },
      },
    },
  });

  if (!createdToken) {
    throw new Error(`სავერიფიკაცი ტოკენის შექმნა ვერ მოხერხდა`);
  }

  return sendConfirmationEmail({ userId: user.id });
};
