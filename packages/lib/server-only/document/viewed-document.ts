import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { ReadStatus } from '@documenso/prisma/client';
import { WebhookTriggerEvents } from '@documenso/prisma/client';

import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';
import { getDocumentAndRecipientByToken } from './get-document-by-token';

export type ViewedDocumentOptions = {
  token: string;
  requestMetadata?: RequestMetadata;
};

export const viewedDocument = async ({ token, requestMetadata }: ViewedDocumentOptions) => {
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
        },
      }),
    });
  });

  const document = await getDocumentAndRecipientByToken({ token });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_OPENED,
    data: document,
    userId: document.userId,
    teamId: document.teamId ?? undefined,
  });
};
