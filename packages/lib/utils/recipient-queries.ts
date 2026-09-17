import type { Prisma, Recipient } from '@prisma/client';
import { RecipientRole, SigningStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '../errors/app-error';

/**
 * Prisma `where` input matching recipients in the assistant's envelope in
 * strictly LATER signing steps.
 */
export const getLaterSigningStepRecipientsWhereInput = (
  assistant: Pick<Recipient, 'envelopeId'> & { signingOrder: number },
): Prisma.RecipientWhereInput => {
  // Backup guard.
  if (!Number.isFinite(assistant.signingOrder)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Assistant signing order must be a finite number',
    });
  }

  return {
    envelopeId: assistant.envelopeId,
    OR: [
      {
        signingOrder: {
          gt: assistant.signingOrder,
        },
      },
      {
        signingOrder: null,
      },
    ],
  };
};

/**
 * Prisma `where` input matching every recipient an assistant may act for:
 * themself, plus recipients in strictly later steps — never their own group
 * peers. Scoped to the assistant's envelope.
 */
export const getAssistableRecipientsWhereInput = (
  assistant: Pick<Recipient, 'id' | 'signingOrder' | 'envelopeId'>,
): Prisma.RecipientWhereInput => {
  if (typeof assistant.signingOrder !== 'number') {
    return {
      envelopeId: assistant.envelopeId,
      id: assistant.id,
    };
  }

  return {
    envelopeId: assistant.envelopeId,
    OR: [
      {
        id: assistant.id,
      },
      getLaterSigningStepRecipientsWhereInput({
        envelopeId: assistant.envelopeId,
        signingOrder: assistant.signingOrder,
      }),
    ],
  };
};

/**
 * Prisma `where` input matching the recipients whose fields the token holder
 * may act on: non-assistants may only act on their own fields, while
 * assistants may also act on fields of unsigned recipients in strictly later
 * steps.
 *
 * Shared by every field-level endpoint (sign / uninsert, V1 and V2) so the
 * RECIPIENT scoping rule cannot drift between them.
 */
export const getRecipientFieldsWhereInput = ({
  recipient,
  allowAssistantAccessToOtherRecipients,
}: {
  recipient: Pick<Recipient, 'id' | 'role' | 'signingOrder' | 'envelopeId'>;
  allowAssistantAccessToOtherRecipients: boolean;
}): Prisma.RecipientWhereInput => {
  if (recipient.role !== RecipientRole.ASSISTANT || !allowAssistantAccessToOtherRecipients) {
    return { id: recipient.id };
  }

  // Custom query to allow assistants to be able to interact other recipients in the same envelope.
  return {
    signingStatus: {
      not: SigningStatus.SIGNED,
    },
    envelopeId: recipient.envelopeId,
    AND: [getAssistableRecipientsWhereInput(recipient)],
  };
};
