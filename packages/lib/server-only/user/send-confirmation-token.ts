import crypto from 'crypto';

import { prisma } from '@documenso/prisma';

import { ONE_HOUR } from '../../constants/time';
import { sendConfirmationEmail } from '../auth/send-confirmation-email';

const IDENTIFIER = 'confirmation-email';

export const sendConfirmationToken = async ({ email }: { email: string }) => {
  const token = crypto.randomBytes(20).toString('hex');

  const user = await prisma.user.findFirst({
    where: {
      email: email,
    },
  });

  if (!user) {
    throw new Error('User not found');
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
    throw new Error(`Failed to create the verification token`);
  }

  // TODO: Revisit tomorrow
  try {
    await sendConfirmationEmail({ userId: user.id });

    return { success: true };
  } catch (err) {
    throw new Error(`Failed to send the confirmation email`);
  }
};
