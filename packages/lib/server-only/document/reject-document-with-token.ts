import { SigningStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';

import { jobs } from '@documenso/lib/jobs/client';
import { prisma } from '@documenso/prisma';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';

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
      Document: {
        include: {
          User: true,
        },
      },
    },
  });

  const document = recipient?.Document;

  if (!recipient || !document) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Document or recipient not found',
    });
  }

  // Add the audit log entry before updating the recipient

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

  return updatedRecipient;
}
