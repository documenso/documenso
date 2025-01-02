import { ReadStatus, SendStatus } from '@prisma/client';
import { WebhookTriggerEvents } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import type { TDocumentAccessAuthTypes } from '../../types/document-auth';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type ViewedDocumentOptions = {
  token: string;
  recipientAccessAuth?: TDocumentAccessAuthTypes | null;
  requestMetadata?: RequestMetadata;
};

export const viewedDocument = async ({
  token,
  recipientAccessAuth,
  requestMetadata,
}: ViewedDocumentOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      token,
      readStatus: ReadStatus.NOT_OPENED,
    },
  });

  if (!recipient || !recipient.documentId) {
    return;
  }

  const { documentId } = recipient;

  await prisma.$transaction(async (tx) => {
    await tx.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        // This handles cases where distribution is done manually
        sendStatus: SendStatus.SENT,
        readStatus: ReadStatus.OPENED,
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED,
        documentId,
        user: {
          name: recipient.name,
          email: recipient.email,
        },
        requestMetadata,
        data: {
          recipientEmail: recipient.email,
          recipientId: recipient.id,
          recipientName: recipient.name,
          recipientRole: recipient.role,
          accessAuth: recipientAccessAuth || undefined,
        },
      }),
    });
  });

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
    },
    include: {
      documentMeta: true,
      recipients: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_OPENED,
    data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(document)),
    userId: document.userId,
    teamId: document.teamId ?? undefined,
  });
};
