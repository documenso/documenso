import { DocumentStatus, type Prisma, SigningStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getRecipientFieldsWhereInput } from '../../utils/recipient-queries';
import { assertRecipientNotExpired } from '../../utils/recipients';
import { lockEnvelope } from '../envelope/lock-envelope';

export type LockFieldForSigningOptions = {
  envelopeId: string;
  fieldId: number;
  /** The recipient acting on the field: an assistant when prefilling another recipient's field. */
  recipientId: number;
};

/**
 * Locks the envelope and re-reads the field and its recipients. Decide what to write from the
 * returned rows, not from reads made before this.
 */
export const lockFieldForSigning = async (
  tx: Prisma.TransactionClient,
  { envelopeId, fieldId, recipientId }: LockFieldForSigningOptions,
) => {
  const envelope = await lockEnvelope(tx, envelopeId);

  if (envelope.deletedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Document ${envelopeId} has been deleted`,
    });
  }

  if (envelope.status !== DocumentStatus.PENDING) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Document ${envelopeId} must be pending for signing`,
    });
  }

  const recipient = await tx.recipient.findFirst({
    where: {
      id: recipientId,
      envelopeId,
    },
  });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Recipient ${recipientId} not found`,
    });
  }

  const field = await tx.field.findFirst({
    where: {
      id: fieldId,
      envelopeId,
      recipient: getRecipientFieldsWhereInput({
        recipient,
        allowAssistantAccessToOtherRecipients: true,
      }),
    },
    include: {
      recipient: true,
    },
  });

  if (!field) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Field ${fieldId} not found`,
    });
  }

  assertRecipientNotExpired(recipient);
  assertRecipientNotExpired(field.recipient);

  if (recipient.signingStatus === SigningStatus.SIGNED || field.recipient.signingStatus === SigningStatus.SIGNED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Recipient ${recipient.id} has already signed`,
    });
  }

  return {
    recipient,
    field,
  };
};
