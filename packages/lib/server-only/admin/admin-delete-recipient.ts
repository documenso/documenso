import { prisma } from '@documenso/prisma';
import {
  DocumentSigningOrder,
  DocumentStatus,
  EnvelopeType,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobs } from '../../jobs/client';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { isTspEnvelope } from '../../types/signature-level';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { mapSecondaryIdToDocumentId } from '../../utils/envelope';
import { getRecipientsInActiveSigningStep, isRecipientTurnBySigningOrder } from '../../utils/recipient-groups';
import { assertEnvelopeMutable } from '../envelope/assert-envelope-mutable';

export type AdminDeleteRecipientOptions = {
  recipientId: number;
  reason: string;
  requestMetadata: ApiRequestMetadata;
};

/**
 * Unlike `deleteEnvelopeRecipient` this is not team scoped and allows removing
 * recipients who have opened the document or inserted fields, as long as they
 * have not signed.
 */
export const adminDeleteRecipient = async ({ recipientId, reason, requestMetadata }: AdminDeleteRecipientOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
    },
    include: {
      envelope: {
        select: {
          id: true,
          secondaryId: true,
          type: true,
          status: true,
          signatureLevel: true,
          completedAt: true,
          userId: true,
          documentMeta: {
            select: {
              signingOrder: true,
            },
          },
        },
      },
    },
  });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  const { envelope } = recipient;

  if (envelope.type !== EnvelopeType.DOCUMENT) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Recipient does not belong to a document',
    });
  }

  if (envelope.completedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Document already complete',
    });
  }

  if (recipient.signingStatus === SigningStatus.SIGNED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Recipient has already completed signing',
    });
  }

  // The TSP (AES/QES) lock protects WYSIWYS and is not bypassed for admins.
  await assertEnvelopeMutable(envelope);

  const deletedRecipient = await prisma.$transaction(async (tx) => {
    await assertEnvelopeMutable(envelope, tx);

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED,
        envelopeId: envelope.id,
        metadata: requestMetadata,
        data: {
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientId: recipient.id,
          recipientRole: recipient.role,
          removedByAdmin: true,
          reason,
        },
      }),
    });

    return await tx.recipient.delete({
      where: {
        id: recipientId,
      },
    });
  });

  const shouldNotifyRecipient = recipient.sendStatus === SendStatus.SENT && recipient.role !== RecipientRole.CC;

  await jobs.triggerJob({
    name: 'send.admin.recipient.removed.emails',
    payload: {
      envelopeId: envelope.id,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      notifyRecipient: shouldNotifyRecipient,
    },
  });

  // The removed recipient may have been the only thing blocking completion or
  // the next sequential step, so seal or advance as the signing flow would.
  if (envelope.status !== DocumentStatus.PENDING) {
    return deletedRecipient;
  }

  const documentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

  const remainingRecipients = await prisma.recipient.findMany({
    where: {
      envelopeId: envelope.id,
    },
    select: {
      id: true,
      role: true,
      signingOrder: true,
      signingStatus: true,
      sendStatus: true,
    },
    orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
  });

  const signableRecipients = remainingRecipients.filter((recipient) => recipient.role !== RecipientRole.CC);

  // A document left with no signers stays pending rather than sealing with no signatures.
  const haveAllRecipientsSigned =
    signableRecipients.length > 0 &&
    signableRecipients.every((recipient) => recipient.signingStatus === SigningStatus.SIGNED);

  if (haveAllRecipientsSigned) {
    await jobs.triggerJob({
      name: 'internal.seal-document',
      payload: {
        documentId,
        requestMetadata: requestMetadata.requestMetadata,
      },
    });

    return deletedRecipient;
  }

  if (envelope.documentMeta?.signingOrder !== DocumentSigningOrder.SEQUENTIAL) {
    return deletedRecipient;
  }

  const recipientsToSend = getRecipientsInActiveSigningStep(remainingRecipients, {
    strictlySequential: isTspEnvelope(envelope),
  }).filter(
    (recipient) =>
      recipient.sendStatus !== SendStatus.SENT &&
      isRecipientTurnBySigningOrder(remainingRecipients, recipient, { strictlySequential: isTspEnvelope(envelope) }),
  );

  if (recipientsToSend.length === 0) {
    return deletedRecipient;
  }

  await prisma.recipient.updateMany({
    where: {
      id: {
        in: recipientsToSend.map((recipient) => recipient.id),
      },
    },
    data: {
      sendStatus: SendStatus.SENT,
      sentAt: new Date(),
    },
  });

  await Promise.allSettled(
    recipientsToSend.map(async (recipient) =>
      jobs.triggerJob({
        name: 'send.signing.requested.email',
        payload: {
          userId: envelope.userId,
          documentId,
          recipientId: recipient.id,
          requestMetadata: requestMetadata.requestMetadata,
        },
      }),
    ),
  );

  return deletedRecipient;
};
