import { prisma } from '@documenso/prisma';
import { SigningStatus } from '@documenso/prisma/client';

export type IsRecipientExpiredOptions = {
  token: string;
};

export const isRecipientExpired = async ({ token }: IsRecipientExpiredOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      token,
    },
  });

  if (!recipient) {
    throw new Error('Recipient not found');
  }

  const now = new Date();
  const hasExpired = recipient.expired && new Date(recipient.expired) <= now;

  if (hasExpired && recipient.signingStatus !== SigningStatus.EXPIRED) {
    await prisma.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        signingStatus: SigningStatus.EXPIRED,
      },
    });
  }

  return hasExpired;
};
