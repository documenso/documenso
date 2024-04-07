import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';
import { ReadStatus } from '@documenso/prisma/client';
import { WebhookTriggerEvents } from '@documenso/prisma/client';

import type { TDocumentAccessAuthTypes } from '../../types/document-auth';
import { queueJob } from '../queue/job';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';
import { getDocumentAndRecipientByToken } from './get-document-by-token';

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

  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      readStatus: ReadStatus.OPENED,
    },
  });

  await queueJob({
    job: 'create-document-audit-log',
    args: {
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
    },
  });

  const document = await getDocumentAndRecipientByToken({ token, requireAccessAuth: false });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_OPENED,
    data: document,
    userId: document.userId,
    teamId: document.teamId ?? undefined,
  });
};
