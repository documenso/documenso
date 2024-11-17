import { prisma } from '@documenso/prisma';
import type { Team } from '@documenso/prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData, diffRecipientChanges } from '../../utils/document-audit-logs';

export type SetRecipientExpiryOptions = {
  documentId: number;
  recipientId: number;
  expiry: Date;
  userId: number;
  teamId?: number;
  requestMetadata?: RequestMetadata;
};

export const setRecipientExpiry = async ({
  documentId,
  recipientId,
  expiry,
  userId,
  teamId,
  requestMetadata,
}: SetRecipientExpiryOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      Document: {
        id: documentId,
        ...(teamId
          ? {
              team: {
                id: teamId,
                members: {
                  some: {
                    userId,
                  },
                },
              },
            }
          : {
              userId,
              teamId: null,
            }),
      },
    },
  });

  if (!recipient) {
    throw new Error('Recipient not found');
  }

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  let team: Team | null = null;

  if (teamId) {
    team = await prisma.team.findFirst({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
    });
  }

  const updatedRecipient = await prisma.$transaction(async (tx) => {
    const persisted = await tx.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        expired: new Date(expiry),
      },
    });

    const changes = diffRecipientChanges(recipient, persisted);

    if (changes.length > 0) {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED,
          documentId: documentId,
          user: {
            id: team?.id ?? user.id,
            name: team?.name ?? user.name,
            email: team ? '' : user.email,
          },
          requestMetadata,
          data: {
            changes,
            recipientId,
            recipientEmail: persisted.email,
            recipientName: persisted.name,
            recipientRole: persisted.role,
          },
        }),
      });

      return persisted;
    }
  });

  return updatedRecipient;
};
