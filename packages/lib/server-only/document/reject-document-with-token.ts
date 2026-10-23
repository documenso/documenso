// This is closely related to `reject-document-on-behalf-of.ts` but is intentionally
// kept as a separate method rather than merged into one. This file focuses on
// rejection from a recipient perspective (the recipient rejecting via their token),
// whereas `reject-document-on-behalf-of.ts` focuses on it from an API/programmatic
// perspective (an authenticated API user acting on behalf of a recipient).
//
// Code changes in one should probably be mirrored to the other, particularly in
// relation to the jobs triggered after a rejection.
import { jobs } from '@documenso/lib/jobs/client';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, EnvelopeType, SigningStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { mapSecondaryIdToDocumentId, unsafeBuildEnvelopeIdQuery } from '../../utils/envelope';
import { assertRecipientNotExpired } from '../../utils/recipients';
import { assertSenderNotDisabled } from '../user/assert-user-not-disabled';

export type RejectDocumentWithTokenOptions = {
  token: string;
  id: EnvelopeIdOptions;
  reason: string;
  requestMetadata?: RequestMetadata;
};

export async function rejectDocumentWithToken({ token, id, reason, requestMetadata }: RejectDocumentWithTokenOptions) {
  // Find the recipient and document in a single query
  const recipient = await prisma.recipient.findFirst({
    where: {
      token,
      envelope: unsafeBuildEnvelopeIdQuery(id, EnvelopeType.DOCUMENT),
    },
    include: {
      envelope: true,
    },
  });

  const envelope = recipient?.envelope;

  if (!recipient || !envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document or recipient not found',
    });
  }

  await assertSenderNotDisabled({ userId: envelope.userId });

  if (envelope.status !== DocumentStatus.PENDING) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Document ${envelope.id} must be pending to reject`,
    });
  }

  if (recipient.signingStatus !== SigningStatus.NOT_SIGNED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Recipient ${recipient.id} has already actioned this document`,
    });
  }

  assertRecipientNotExpired(recipient);

  // Mark the envelope REJECTED here rather than waiting for the seal job, so other
  // recipients are locked out as soon as this returns.
  const updatedRecipient = await prisma.$transaction(async (tx) => {
    // Conditional so two concurrent rejections can't both succeed.
    const { count } = await tx.envelope.updateMany({
      where: {
        id: envelope.id,
        status: DocumentStatus.PENDING,
      },
      data: {
        status: DocumentStatus.REJECTED,
      },
    });

    if (count === 0) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Document ${envelope.id} must be pending to reject`,
      });
    }

    const rejectedRecipient = await tx.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        signedAt: new Date(),
        signingStatus: SigningStatus.REJECTED,
        rejectionReason: reason,
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        envelopeId: envelope.id,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED,
        user: {
          name: recipient.name,
          email: recipient.email,
        },
        data: {
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientId: recipient.id,
          recipientRole: recipient.role,
          reason,
        },
        requestMetadata,
      }),
    });

    return rejectedRecipient;
  });

  const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

  // Trigger the seal document job to process the document asynchronously
  await jobs.triggerJob({
    name: 'internal.seal-document',
    payload: {
      documentId: legacyDocumentId,
      requestMetadata,
    },
  });

  // Send email notifications to the rejecting recipient
  await jobs.triggerJob({
    name: 'send.signing.rejected.emails',
    payload: {
      recipientId: recipient.id,
      documentId: legacyDocumentId,
    },
  });

  // Send cancellation emails to other recipients
  await jobs.triggerJob({
    name: 'send.document.cancelled.emails',
    payload: {
      documentId: legacyDocumentId,
      cancellationReason: reason,
      requestMetadata,
    },
  });

  return updatedRecipient;
}
