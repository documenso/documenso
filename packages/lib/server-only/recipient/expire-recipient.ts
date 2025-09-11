import { SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type ExpireRecipientOptions = {
  recipientId: number;
};

export const expireRecipient = async ({ recipientId }: ExpireRecipientOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
    },
    select: {
      id: true,
      signingStatus: true,
    },
  });

  if (!recipient) {
    return null;
  }

  if (recipient.signingStatus === SigningStatus.EXPIRED) {
    return recipient;
  }

  return await prisma.recipient.update({
    where: {
      id: recipientId,
    },
    data: {
      signingStatus: SigningStatus.EXPIRED,
    },
  });
};
