import { prisma } from '@documenso/prisma';
import type { Team } from '@documenso/prisma/client';

import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';

export type DeleteFieldOptions = {
  fieldId: number;
  documentId: number;
  userId: number;
  teamId?: number;
  requestMetadata?: RequestMetadata;
};

export const deleteField = async ({
  fieldId,
  userId,
  teamId,
  documentId,
  requestMetadata,
}: DeleteFieldOptions) => {
  const field = await prisma.field.delete({
    where: {
      id: fieldId,
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
    include: {
      Recipient: true,
    },
  });

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  let team: Team | null = null;

  if (teamId) {
    team = await prisma.team.findFirstOrThrow({
      where: {
        id: teamId,
      },
    });
  }

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: 'FIELD_DELETED',
      documentId,
      user: {
        id: team?.id ?? user.id,
        email: team?.name ?? user.email,
        name: team ? '' : user.name,
      },
      data: {
        fieldId: field.secondaryId,
        fieldRecipientEmail: field.Recipient?.email ?? '',
        fieldRecipientId: field.recipientId ?? -1,
        fieldType: field.type,
      },
      requestMetadata,
    }),
  });

  return field;
};
