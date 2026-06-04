import { DocumentSigningOrder, EnvelopeType, SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

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

  if (envelope.documentMeta?.signingOrder !== DocumentSigningOrder.SEQUENTIAL) {
    return true;
  }

  const { recipients } = envelope;

  const currentRecipient = recipients.find((r) => r.token === token);

  if (!currentRecipient) {
    return false;
  }

  // Multiple recipients may share the same signing order (a "slot"), in which case
  // they sign in parallel. A recipient may sign once every recipient in a strictly
  // earlier slot has signed. Recipients without a signing order are treated as last
  // to mirror the `nulls: 'last'` ordering used elsewhere.
  const slotOf = (signingOrder: number | null) => signingOrder ?? Number.MAX_SAFE_INTEGER;

  const currentSlot = slotOf(currentRecipient.signingOrder);

  for (const recipient of recipients) {
    if (slotOf(recipient.signingOrder) < currentSlot && recipient.signingStatus !== SigningStatus.SIGNED) {
      return false;
    }
  }

  return true;
}
