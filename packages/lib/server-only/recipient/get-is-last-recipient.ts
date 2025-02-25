import { prisma } from '@documenso/prisma';
import { DocumentSigningOrder, RecipientRole, SigningStatus } from '@documenso/prisma/client';

export type GetIsLastRecipientOptions = {
  token: string;
};

export async function getIsLastRecipient({ token }: GetIsLastRecipientOptions) {
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
        where: {
          role: {
            not: RecipientRole.CC,
          },
        },
        orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      },
    },
  });

  if (document.documentMeta?.signingOrder !== DocumentSigningOrder.SEQUENTIAL) {
    const unsignedRecipients = document.recipients.filter(
      (recipient) => recipient.signingStatus !== SigningStatus.SIGNED,
    );

    return unsignedRecipients.length <= 1;
  }

  const { recipients } = document;
  const currentRecipientIndex = recipients.findIndex((r) => r.token === token);

  if (currentRecipientIndex === -1) {
    return false;
  }

  return currentRecipientIndex === recipients.length - 1;
}
