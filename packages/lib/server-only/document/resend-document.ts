import { DocumentStatus, EnvelopeType, RecipientRole, SigningStatus } from '@prisma/client';

import { resolveExpiresAt } from '@documenso/lib/constants/envelope-expiration';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

import { jobs } from '../../jobs/client';
import { isDocumentCompleted } from '../../utils/document';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type ResendDocumentOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  recipients: number[];
  teamId: number;
  requestMetadata: ApiRequestMetadata;
};

export const resendDocument = async ({
  id,
  userId,
  recipients,
  teamId,
  requestMetadata,
}: ResendDocumentOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
    include: {
      recipients: true,
      documentMeta: true,
    },
  });

  if (!envelope) {
    throw new Error('Document not found');
  }

  if (envelope.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  if (envelope.status === DocumentStatus.DRAFT) {
    throw new Error('Can not send draft document');
  }

  if (isDocumentCompleted(envelope.status)) {
    throw new Error('Can not send completed document');
  }

  // Refresh the expiresAt on each resent recipient.
  const expiresAt = resolveExpiresAt(envelope.documentMeta?.envelopeExpirationPeriod ?? null);

  const recipientsToRemind = envelope.recipients.filter(
    (recipient) =>
      recipients.includes(recipient.id) &&
      recipient.signingStatus === SigningStatus.NOT_SIGNED &&
      recipient.role !== RecipientRole.CC,
  );

  // Extend the expiration deadline for recipients being resent.
  if (expiresAt && recipientsToRemind.length > 0) {
    await prisma.recipient.updateMany({
      where: {
        id: {
          in: recipientsToRemind.map((r) => r.id),
        },
      },
      data: {
        expiresAt,
        expirationNotifiedAt: null,
      },
    });
  }

  // Dispatch the email sending to a background job so that email delivery
  // failures don't block the resend operation and can be retried independently.
  if (recipientsToRemind.length > 0) {
    await jobs.triggerJob({
      name: 'send.resend.document.email',
      payload: {
        envelopeId: envelope.id,
        userId,
        teamId: envelope.teamId,
        recipientIds: recipientsToRemind.map((r) => r.id),
        requestMetadata,
      },
    });
  }

  return envelope;
};
