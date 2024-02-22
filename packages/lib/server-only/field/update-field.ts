import { prisma } from '@documenso/prisma';
import type { FieldType, Team } from '@documenso/prisma/client';

import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';

export type UpdateFieldOptions = {
  fieldId: number;
  documentId: number;
  userId: number;
  teamId?: number;
  recipientId?: number;
  type?: FieldType;
  pageNumber?: number;
  pageX?: number;
  pageY?: number;
  pageWidth?: number;
  pageHeight?: number;
  requestMetadata?: RequestMetadata;
};

export const updateField = async ({
  fieldId,
  documentId,
  userId,
  teamId,
  recipientId,
  type,
  pageNumber,
  pageX,
  pageY,
  pageWidth,
  pageHeight,
  requestMetadata,
}: UpdateFieldOptions) => {
  const field = await prisma.field.update({
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
    data: {
      recipientId,
      type,
      page: pageNumber,
      positionX: pageX,
      positionY: pageY,
      width: pageWidth,
      height: pageHeight,
    },
    include: {
      Recipient: true,
    },
  });

  if (!field) {
    throw new Error('Field not found');
  }

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

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: 'FIELD_UPDATED',
      documentId,
      user: {
        id: team?.id ?? user.id,
        email: team?.name ?? user.email,
        name: team ? '' : user.name,
      },
      data: {
        fieldId: field.secondaryId,
        fieldRecipientEmail: field.Recipient?.email ?? '',
        fieldRecipientId: recipientId ?? -1,
        fieldType: field.type,
      },
      requestMetadata,
    }),
  });

  return field;
};
