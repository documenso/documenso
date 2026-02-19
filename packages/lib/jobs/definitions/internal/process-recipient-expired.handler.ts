import { SigningStatus, WebhookTriggerEvents } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { triggerWebhook } from '../../../server-only/webhooks/trigger/trigger-webhook';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../../types/webhook-payload';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { jobs } from '../../client';
import type { JobRunIO } from '../../client/_internal/job';
import type { TProcessRecipientExpiredJobDefinition } from './process-recipient-expired';

export const run = async ({
  payload,
  io,
}: {
  payload: TProcessRecipientExpiredJobDefinition;
  io: JobRunIO;
}) => {
  const { recipientId } = payload;

  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      expirationNotifiedAt: null,
      signingStatus: {
        notIn: [SigningStatus.SIGNED, SigningStatus.REJECTED],
      },
    },
    include: {
      envelope: {
        include: {
          recipients: true,
          documentMeta: true,
        },
      },
    },
  });

  if (!recipient) {
    io.logger.info(`Recipient ${recipientId} already processed or no longer eligible, skipping`);
    return;
  }

  const { envelope } = recipient;

  // Set expirationNotifiedAt to make this idempotent.
  await prisma.recipient.update({
    where: { id: recipientId },
    data: {
      expirationNotifiedAt: new Date(),
    },
  });

  io.logger.info(
    `Recipient ${recipientId} (${recipient.email}) expired on envelope ${recipient.envelopeId}`,
  );

  // Create audit log entry.
  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_EXPIRED,
      envelopeId: recipient.envelopeId,
      data: {
        recipientEmail: recipient.email,
        recipientName: recipient.name,
      },
    }),
  });

  // Trigger webhook for recipient expiration.
  await triggerWebhook({
    event: WebhookTriggerEvents.RECIPIENT_EXPIRED,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(envelope)),
    userId: envelope.userId,
    teamId: envelope.teamId,
  });

  // Trigger email notification to the document owner.
  await jobs.triggerJob({
    name: 'send.owner.recipient.expired.email',
    payload: {
      recipientId: recipient.id,
      envelopeId: recipient.envelopeId,
    },
  });
};
