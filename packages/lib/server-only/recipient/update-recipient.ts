import type { RecipientRole, Team } from '@prisma/client';

import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import {
  type TRecipientActionAuthTypes,
  ZRecipientAuthOptionsSchema,
} from '../../types/document-auth';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData, diffRecipientChanges } from '../../utils/document-audit-logs';
import { createRecipientAuthOptions } from '../../utils/document-auth';

export type UpdateRecipientOptions = {
  documentId: number;
  recipientId: number;
  email?: string;
  name?: string;
  role?: RecipientRole;
  signingOrder?: number | null;
  actionAuth?: TRecipientActionAuthTypes | null;
  userId: number;
  teamId?: number;
  requestMetadata?: RequestMetadata;
};

export const updateRecipient = async ({
  documentId,
  recipientId,
  email,
  name,
  role,
  signingOrder,
  actionAuth,
  userId,
  teamId,
  requestMetadata,
}: UpdateRecipientOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      document: {
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
      document: true,
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

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  if (!recipient) {
    throw new Error('Recipient not found');
  }

  if (actionAuth) {
    const isDocumentEnterprise = await isUserEnterprise({
      userId,
      teamId,
    });

    if (!isDocumentEnterprise) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to set the action auth',
      });
    }
  }

  const recipientAuthOptions = ZRecipientAuthOptionsSchema.parse(recipient.authOptions);

  const updatedRecipient = await prisma.$transaction(async (tx) => {
    const persisted = await prisma.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        email: email?.toLowerCase() ?? recipient.email,
        name: name ?? recipient.name,
        role: role ?? recipient.role,
        signingOrder,
        authOptions: createRecipientAuthOptions({
          accessAuth: recipientAuthOptions.accessAuth,
          actionAuth: actionAuth ?? null,
        }),
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
