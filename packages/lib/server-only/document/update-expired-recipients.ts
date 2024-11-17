import { prisma } from '@documenso/prisma';
import { SigningStatus } from '@documenso/prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';

export const updateExpiredRecipients = async (documentId: number) => {
  const now = new Date();

  const expiredRecipients = await prisma.recipient.findMany({
    where: {
      documentId,
      expired: {
        lt: now,
      },
      signingStatus: {
        not: SigningStatus.EXPIRED,
      },
    },
  });

  if (expiredRecipients.length > 0) {
    await prisma.recipient.updateMany({
      where: {
        id: {
          in: expiredRecipients.map((recipient) => recipient.id),
        },
      },
      data: {
        signingStatus: SigningStatus.EXPIRED,
      },
    });

    await Promise.all(
      expiredRecipients.map(async (recipient) =>
        prisma.documentAuditLog.create({
          data: createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_EXPIRED,
            documentId,
            user: {
              name: recipient.name,
              email: recipient.email,
            },
            data: {
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              recipientId: recipient.id,
              recipientRole: recipient.role,
            },
          }),
        }),
      ),
    );
  }

  return expiredRecipients;
};
