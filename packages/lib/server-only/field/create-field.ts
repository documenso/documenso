import { prisma } from '@documenso/prisma';
import type { FieldType, Team } from '@documenso/prisma/client';

import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';

export type CreateFieldOptions = {
  documentId: number;
  userId: number;
  teamId?: number;
  recipientId: number;
  type: FieldType;
  pageNumber: number;
  pageX: number;
  pageY: number;
  pageWidth: number;
  pageHeight: number;
  requestMetadata?: RequestMetadata;
};

export const createField = async ({
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
}: CreateFieldOptions) => {
  const document = await prisma.document.findFirst({
    select: {
      id: true,
    },
    where: {
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
  });

  if (!document) {
    throw new Error('Document not found');
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

  const field = await prisma.field.create({
    data: {
      documentId,
      recipientId,
      type,
      page: pageNumber,
      positionX: pageX,
      positionY: pageY,
      width: pageWidth,
      height: pageHeight,
      customText: '',
      inserted: false,
    },
    include: {
      Recipient: true,
    },
  });

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: 'FIELD_CREATED',
      documentId,
      user: {
        id: team?.id ?? user.id,
        email: team?.name ?? user.email,
        name: team ? '' : user.name,
      },
      data: {
        fieldId: field.secondaryId,
        fieldRecipientEmail: field.Recipient?.email ?? '',
        fieldRecipientId: recipientId,
        fieldType: field.type,
      },
      requestMetadata,
    }),
  });

  return field;
};
