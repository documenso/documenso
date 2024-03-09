import { prisma } from '@documenso/prisma';
import type { Team } from '@documenso/prisma/client';
import { SendStatus } from '@documenso/prisma/client';

import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';

export type DeleteRecipientOptions = {
  documentId: number;
  recipientId: number;
  userId: number;
  teamId?: number;
  requestMetadata?: RequestMetadata;
};

export const deleteRecipient = async ({
  documentId,
  recipientId,
  userId,
  teamId,
  requestMetadata,
}: DeleteRecipientOptions) => {
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

  if (recipient.sendStatus !== SendStatus.NOT_SENT) {
    throw new Error('Can not delete a recipient that has already been sent a document');
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

  const deletedRecipient = await prisma.$transaction(async (tx) => {
    const deleted = await tx.recipient.delete({
      where: {
        id: recipient.id,
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: 'RECIPIENT_DELETED',
        documentId,
        user: {
          id: team?.id ?? user.id,
          email: team?.name ?? user.email,
          name: team ? '' : user.name,
        },
        data: {
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientId: recipient.id,
          recipientRole: recipient.role,
        },
        requestMetadata,
      }),
    });

    return deleted;
  });

  return deletedRecipient;
};
