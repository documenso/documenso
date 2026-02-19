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

  // Atomic idempotency guard — only one concurrent worker wins.
  // Wrapping in runTask caches the result so that on retry the claim is not
  // re-evaluated and subsequent steps can still proceed.
  const claimedCount = await io.runTask('claim-recipient', async () => {
    const result = await prisma.recipient.updateMany({
      where: {
        id: recipientId,
        expirationNotifiedAt: null,
        signingStatus: { notIn: [SigningStatus.SIGNED, SigningStatus.REJECTED] },
      },
      data: { expirationNotifiedAt: new Date() },
    });

    return result.count;
  });

  if (claimedCount === 0) {
    io.logger.info(`Recipient ${recipientId} already processed or no longer eligible, skipping`);
    return;
  }

  // Fetch recipient (now marked) with its envelope for downstream steps.
  // Re-fetch after claiming so that expirationNotifiedAt reflects the updated value
  // and webhook consumers see consistent state.
  const recipient = await prisma.recipient.findUniqueOrThrow({
    where: { id: recipientId },
    include: {
      envelope: {
        include: { recipients: true, documentMeta: true },
      },
    },
  });

  const { envelope } = recipient;

  io.logger.info(
    `Recipient ${recipientId} (${recipient.email}) expired on envelope ${recipient.envelopeId}`,
  );

  // Create audit log entry — wrapped so a retry skips this if it already succeeded.
  await io.runTask('create-audit-log', async () => {
    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_EXPIRED,
        envelopeId: recipient.envelopeId,
        data: {
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientId: recipient.id,
        },
      }),
    });
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
