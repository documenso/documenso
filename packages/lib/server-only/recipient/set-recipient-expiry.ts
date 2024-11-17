import { prisma } from '@documenso/prisma';
import type { Team } from '@documenso/prisma/client';

import type { RequestMetadata } from '../../universal/extract-request-metadata';

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
    const updated = await tx.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        expired: new Date(expiry),
      },
    });

    // TODO: fix the audit logs
    // await tx.documentAuditLog.create({
    //   data: createDocumentAuditLogData({
    //     type: 'RECIPIENT_EXPIRY_UPDATED',
    //     documentId,
    //     user: {
    //       id: team?.id ?? user.id,
    //       email: team?.name ?? user.email,
    //       name: team ? '' : user.name,
    //     },
    //     data: {
    //       recipientEmail: recipient.email,
    //       recipientName: recipient.name,
    //       recipientId: recipient.id,
    //       recipientRole: recipient.role,
    //       expiry,
    //     },
    //     requestMetadata,
    //   }),
    // });

    return updated;
  });

  return updatedRecipient;
};
