import { prisma } from '@documenso/prisma';
import { EnvelopeType, FieldType, RecipientRole, SigningStatus } from '@prisma/client';

import { getLaterSigningStepRecipientsWhereInput } from '../../utils/recipients';

export type GetFieldsForTokenOptions = {
  token: string;
};

// Note: You many need to filter this on a per envelope item ID basis.
export const getFieldsForToken = async ({ token }: GetFieldsForTokenOptions) => {
  if (!token) {
    throw new Error('Missing token');
  }

  const recipient = await prisma.recipient.findFirst({
    where: { token },
  });

  if (!recipient) {
    return [];
  }

  if (recipient.role === RecipientRole.ASSISTANT) {
    return await prisma.field.findMany({
      where: {
        OR: [
          {
            type: {
              not: FieldType.SIGNATURE,
            },
            recipient: {
              signingStatus: {
                not: SigningStatus.SIGNED,
              },
              envelopeId: recipient.envelopeId,
              // Assistants can only assist those in strictly later steps —
              // never their own group peers, with null orders as the tail
              // step. (Own fields are matched by the sibling OR arm.)
              AND: [getLaterSigningStepRecipientsWhereInput(recipient)],
            },
            envelope: {
              id: recipient.envelopeId,
              type: EnvelopeType.DOCUMENT,
            },
          },
          {
            recipientId: recipient.id,
          },
        ],
      },
      include: {
        signature: true,
      },
    });
  }

  return await prisma.field.findMany({
    where: {
      recipientId: recipient.id,
    },
    include: {
      signature: true,
    },
  });
};
