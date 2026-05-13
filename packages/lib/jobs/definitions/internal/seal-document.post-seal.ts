import { prisma } from '@documenso/prisma';
import type { DocumentStatus } from '@prisma/client';
import { WebhookTriggerEvents } from '@prisma/client';

import { sendCompletedEmail } from '../../../server-only/document/send-completed-email';
import { triggerWebhook } from '../../../server-only/webhooks/trigger/trigger-webhook';
import { mapEnvelopeToWebhookDocumentPayload, ZWebhookDocumentSchema } from '../../../types/webhook-payload';
import type { RequestMetadata } from '../../../universal/extract-request-metadata';
import { isDocumentCompleted } from '../../../utils/document';
import type { JobRunIO } from '../../client/_internal/job';

type RunPostSealDocumentTasksOptions = {
  envelopeId: string;
  envelopeStatus: DocumentStatus;
  isRejected: boolean;
  isResealing: boolean;
  requestMetadata?: RequestMetadata;
  sendEmail: boolean;
  io: JobRunIO;
};

export const runPostSealDocumentTasks = async ({
  envelopeId,
  envelopeStatus,
  isRejected,
  isResealing,
  requestMetadata,
  sendEmail,
  io,
}: RunPostSealDocumentTasksOptions) => {
  await io.runTask('trigger-document-webhook', async () => {
    const updatedEnvelope = await prisma.envelope.findFirstOrThrow({
      where: {
        id: envelopeId,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });

    await triggerWebhook({
      event: isRejected ? WebhookTriggerEvents.DOCUMENT_REJECTED : WebhookTriggerEvents.DOCUMENT_COMPLETED,
      data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(updatedEnvelope)),
      userId: updatedEnvelope.userId,
      teamId: updatedEnvelope.teamId ?? undefined,
    });
  });

  await io.runTask('send-completed-email', async () => {
    let shouldSendCompletedEmail = sendEmail && !isResealing && !isRejected;

    if (isResealing && !isDocumentCompleted(envelopeStatus)) {
      shouldSendCompletedEmail = sendEmail;
    }

    if (shouldSendCompletedEmail) {
      await sendCompletedEmail({
        id: { type: 'envelopeId', id: envelopeId },
        requestMetadata,
      });
    }
  });
};
