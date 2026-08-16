import { prisma } from '@documenso/prisma';
import type { Envelope, Recipient } from '@prisma/client';
import { BackgroundJobStatus, DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';

import { mapSecondaryIdToDocumentId } from '../../utils/envelope';

export type SigningStatusResponse = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED';

export const getSigningStatus = async (
  envelope: Pick<Envelope, 'status' | 'secondaryId'> & {
    recipients: Pick<Recipient, 'signingStatus' | 'role'>[];
  },
): Promise<SigningStatusResponse> => {
  // Check if envelope is rejected
  if (envelope.status === DocumentStatus.REJECTED) {
    return 'REJECTED';
  }

  if (envelope.status === DocumentStatus.COMPLETED) {
    return 'COMPLETED';
  }

  const isComplete =
    envelope.recipients.some((recipient) => recipient.signingStatus === SigningStatus.REJECTED) ||
    envelope.recipients.every(
      (recipient) => recipient.role === RecipientRole.CC || recipient.signingStatus === SigningStatus.SIGNED,
    );

  if (isComplete) {
    const documentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

    const sealJob = await prisma.backgroundJob.findFirst({
      where: {
        jobId: 'internal.seal-document',
        payload: {
          path: ['documentId'],
          equals: documentId,
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    if (sealJob?.status === BackgroundJobStatus.FAILED) {
      return 'FAILED';
    }

    return 'PROCESSING';
  }

  return 'PENDING';
};
