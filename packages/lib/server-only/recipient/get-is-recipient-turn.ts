import { prisma } from '@documenso/prisma';
import { DocumentSigningOrder, EnvelopeType, RecipientRole, SigningStatus } from '@prisma/client';

export type GetIsRecipientTurnOptions = {
  token: string;
};

export async function getIsRecipientsTurnToSign({ token }: GetIsRecipientTurnOptions) {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      type: EnvelopeType.DOCUMENT,
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

  const { recipients } = envelope;

  const currentRecipientIndex = recipients.findIndex((r) => r.token === token);

  if (currentRecipientIndex === -1) {
    return false;
  }

  const currentRecipient = recipients[currentRecipientIndex];

  // Assistants always act before signers, regardless of signing order.
  // If the current recipient is not an assistant, check that all assistants have completed first.
  if (currentRecipient.role !== RecipientRole.ASSISTANT) {
    const hasPendingAssistants = recipients.some(
      (r) =>
        r.role === RecipientRole.ASSISTANT &&
        r.signingStatus !== SigningStatus.SIGNED &&
        r.id !== currentRecipient.id,
    );

    if (hasPendingAssistants) {
      return false;
    }
  }

  // For SEQUENTIAL signing, check that all recipients before the current one have signed.
  if (envelope.documentMeta?.signingOrder === DocumentSigningOrder.SEQUENTIAL) {
    for (let i = 0; i < currentRecipientIndex; i++) {
      if (recipients[i].signingStatus !== SigningStatus.SIGNED) {
        return false;
      }
    }
  }

  return true;
}
