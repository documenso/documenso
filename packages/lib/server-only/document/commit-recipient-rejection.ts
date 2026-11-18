import type { Prisma } from '@prisma/client';
import { DocumentStatus, SigningStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

type CommitRecipientRejectionOptions = {
  envelopeId: string;
  recipientId: number;
  reason: string;
};

/**
 * Moves the envelope from PENDING to REJECTED and the recipient from NOT_SIGNED
 * to REJECTED. The envelope is marked here rather than by the seal job, so other
 * recipients are locked out as soon as the caller's transaction commits.
 *
 * Must run inside the transaction that records the rejection. Both updates are
 * conditional: a rejection or a completion that got in first makes this throw,
 * and the throw is what rolls the envelope back to PENDING.
 */
export const commitRecipientRejection = async (
  tx: Prisma.TransactionClient,
  { envelopeId, recipientId, reason }: CommitRecipientRejectionOptions,
) => {
  const { count: rejectedEnvelopeCount } = await tx.envelope.updateMany({
    where: {
      id: envelopeId,
      status: DocumentStatus.PENDING,
    },
    data: {
      status: DocumentStatus.REJECTED,
    },
  });

  if (rejectedEnvelopeCount === 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Document ${envelopeId} must be pending to reject`,
    });
  }

  const [rejectedRecipient] = await tx.recipient.updateManyAndReturn({
    where: {
      id: recipientId,
      signingStatus: SigningStatus.NOT_SIGNED,
    },
    data: {
      signedAt: new Date(),
      signingStatus: SigningStatus.REJECTED,
      rejectionReason: reason,
    },
  });

  if (!rejectedRecipient) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Recipient ${recipientId} has already actioned this document`,
    });
  }

  return rejectedRecipient;
};
