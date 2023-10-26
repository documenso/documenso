import crypto from 'crypto';

import { prisma } from '@documenso/prisma';

import { ONE_HOUR } from '../../constants/time';
import { sendConfirmationEmail } from '../auth/send-confirmation-email';

const IDENTIFIER = 'confirmation-email';

export const generateConfirmationToken = async ({ email }: { email: string }) => {
  const now = new Date();
  const token = crypto.randomBytes(20).toString('hex');

  const expirationDate = new Date(now.getTime() + ONE_HOUR);

  const user = await prisma.user.findFirst({
    where: {
      email: email,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  try {
    await prisma.verificationToken.create({
      data: {
        identifier: IDENTIFIER,
        token: token,
        expires: expirationDate,
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });
  } catch (error) {
    throw new Error(`Failed to create the verification token: ${error}`);
  }

  return await sendConfirmationEmail({ userId: user.id });
};
