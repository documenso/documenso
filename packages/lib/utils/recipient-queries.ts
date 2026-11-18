import type { Prisma, Recipient } from '@prisma/client';
import { RecipientRole, SigningStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '../errors/app-error';

/**
 * Prisma `where` input matching recipients in the assistant's envelope
 * positioned strictly after the assistant, mirroring
 * `compareRecipientSigningPosition`. Same-step peers are never included.
 */
export const getLaterSigningStepRecipientsWhereInput = (
  assistant: Pick<Recipient, 'id' | 'signingOrder' | 'envelopeId'>,
): Prisma.RecipientWhereInput => {
  // `{ gt: undefined }` is silently dropped by Prisma, turning the predicate
  // into match-everything.
  if (!Number.isFinite(assistant.id)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Assistant id must be a finite number',
    });
  }

  if (assistant.signingOrder === null || assistant.signingOrder === undefined) {
    return {
      envelopeId: assistant.envelopeId,
      signingOrder: null,
      id: {
        gt: assistant.id,
      },
    };
  }

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
 * themself, plus recipients positioned strictly after them — never their own
 * group peers. Scoped to the assistant's envelope.
 */
export const getAssistableRecipientsWhereInput = (
  assistant: Pick<Recipient, 'id' | 'signingOrder' | 'envelopeId'>,
): Prisma.RecipientWhereInput => ({
  envelopeId: assistant.envelopeId,
  OR: [
    {
      id: assistant.id,
    },
    getLaterSigningStepRecipientsWhereInput(assistant),
  ],
});

/**
 * Prisma `where` input matching the recipients whose fields the token holder
 * may act on: non-assistants may only act on their own fields, while
 * assistants may also act on fields of unsigned recipients positioned after
 * them.
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

  return {
    signingStatus: {
      not: SigningStatus.SIGNED,
    },
    envelopeId: recipient.envelopeId,
    AND: [getAssistableRecipientsWhereInput(recipient)],
  };
};
