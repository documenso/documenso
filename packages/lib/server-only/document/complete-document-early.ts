import { DocumentStatus, EnvelopeType, RecipientRole, SigningStatus } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobs } from '../../jobs/client';
import { isDocumentCompleted } from '../../utils/document';
import { type EnvelopeIdOptions, mapSecondaryIdToDocumentId } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type CompleteDocumentEarlyOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
  requestMetadata: ApiRequestMetadata;
};

/**
 * Finalize a pending document on behalf of the owner before every requested
 * recipient has signed.
 *
 * This seals the PDF with the signatures that have been captured so far, allowing
 * the owner to release a document when a signer becomes unavailable, or when only
 * a subset of the requested approvals is actually needed.
 *
 * The early finalization is recorded in the audit log (who, when and which
 * recipients had not yet signed) before the sealing job is triggered.
 */
export const completeDocumentEarly = async ({
  id,
  userId,
  teamId,
  requestMetadata,
}: CompleteDocumentEarlyOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      recipients: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  if (isDocumentCompleted(envelope.status)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Document has already been completed',
    });
  }

  if (envelope.status !== DocumentStatus.PENDING) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only a pending document can be finalized',
    });
  }

  const hasRejection = envelope.recipients.some(
    (recipient) => recipient.signingStatus === SigningStatus.REJECTED,
  );

  if (hasRejection) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'A rejected document cannot be finalized',
    });
  }

  // Recipients (excluding CCs, who never sign) that still have not signed at the
  // time the owner finalizes the document.
  const pendingRecipients = envelope.recipients.filter(
    (recipient) =>
      recipient.role !== RecipientRole.CC &&
      recipient.signingStatus !== SigningStatus.SIGNED,
  );

  const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

  // Record who finalized the document, when, and which recipients had not signed.
  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED_EARLY,
      envelopeId: envelope.id,
      metadata: requestMetadata,
      data: {
        pendingRecipients: pendingRecipients.map((recipient) => ({
          recipientId: recipient.id,
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          recipientRole: recipient.role,
        })),
      },
    }),
  });

  await jobs.triggerJob({
    name: 'internal.seal-document',
    payload: {
      documentId: legacyDocumentId,
      isEarlyCompletion: true,
      requestMetadata: requestMetadata.requestMetadata,
    },
  });

  return prisma.envelope.findFirstOrThrow({
    where: {
      id: envelope.id,
    },
    include: {
      documentMeta: true,
      recipients: true,
    },
  });
};
