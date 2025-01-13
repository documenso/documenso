import { SigningStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';

import { jobs } from '@documenso/lib/jobs/client';
import { prisma } from '@documenso/prisma';
import { WebhookTriggerEvents } from '@documenso/prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type RejectDocumentWithTokenOptions = {
  token: string;
  documentId: number;
  reason: string;
  requestMetadata?: RequestMetadata;
};

export async function rejectDocumentWithToken({
  token,
  documentId,
  reason,
  requestMetadata,
}: RejectDocumentWithTokenOptions) {
  // Find the recipient and document in a single query
  const recipient = await prisma.recipient.findFirst({
    where: {
      token,
      documentId,
    },
    include: {
      document: {
        include: {
          user: true,
          recipients: true,
          documentMeta: true,
        },
      },
    },
  });

  const document = recipient?.document;

  if (!recipient || !document) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Document or recipient not found',
    });
  }

  // Update the recipient status to rejected
  const [updatedRecipient] = await prisma.$transaction([
    prisma.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        signedAt: new Date(),
        signingStatus: SigningStatus.REJECTED,
        rejectionReason: reason,
      },
    }),
    prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        documentId,
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
    }),
  ]);

  // Send email notifications
  await jobs.triggerJob({
    name: 'send.signing.rejected.emails',
    payload: {
      recipientId: recipient.id,
      documentId,
    },
  });

  // Get the updated document with all recipients
  const updatedDocument = await prisma.document.findFirst({
    where: {
      id: document.id,
    },
    include: {
      recipients: true,
      documentMeta: true,
    },
  });

  if (!updatedDocument) {
    throw new Error('Document not found after update');
  }

  // Trigger webhook for document rejection
  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_REJECTED,
    data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(updatedDocument)),
    userId: document.userId,
    teamId: document.teamId ?? undefined,
  });

  return updatedRecipient;
}
