import { DocumentSigningOrder, SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type GetIsRecipientTurnOptions = {
  token: string;
};

export async function getIsRecipientsTurnToSign({ token }: GetIsRecipientTurnOptions) {
  const document = await prisma.document.findFirstOrThrow({
    where: {
      recipients: {
        some: {
          token,
        },
      },
    },
    include: {
      documentMeta: true,
      recipients: {
        orderBy: {
          signingOrder: 'asc',
        },
      },
    },
  });

  if (document.documentMeta?.signingOrder !== DocumentSigningOrder.SEQUENTIAL) {
    return true;
  }

  const { recipients } = document;

  const currentRecipientIndex = recipients.findIndex((r) => r.token === token);

  if (currentRecipientIndex === -1) {
    return false;
  }

  for (let i = 0; i < currentRecipientIndex; i++) {
    if (recipients[i].signingStatus !== SigningStatus.SIGNED) {
      return false;
    }
  }

  return true;
}
