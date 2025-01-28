import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { TRecipientAccessAuthTypes } from '@documenso/lib/types/document-auth';
import { type TRecipientActionAuthTypes } from '@documenso/lib/types/document-auth';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { nanoid } from '@documenso/lib/universal/id';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { createRecipientAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import { RecipientRole } from '@documenso/prisma/client';
import { SendStatus, SigningStatus } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface CreateDocumentRecipientsOptions {
  userId: number;
  teamId?: number;
  documentId: number;
  recipients: {
    email: string;
    name: string;
    role: RecipientRole;
    signingOrder?: number | null;
    accessAuth?: TRecipientAccessAuthTypes | null;
    actionAuth?: TRecipientActionAuthTypes | null;
  }[];
  requestMetadata: ApiRequestMetadata;
}

export const createDocumentRecipients = async ({
  userId,
  teamId,
  documentId,
  recipients: recipientsToCreate,
  requestMetadata,
}: CreateDocumentRecipientsOptions) => {
  const document = await prisma.document.findFirst({
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
    include: {
      recipients: true,
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  if (document.completedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Document already complete',
    });
  }

  const recipientsHaveActionAuth = recipientsToCreate.some((recipient) => recipient.actionAuth);

  // Check if user has permission to set the global action auth.
  if (recipientsHaveActionAuth) {
    const isEnterprise = await isUserEnterprise({
      userId,
      teamId,
    });

    if (!isEnterprise) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to set the action auth',
      });
    }
  }

  const normalizedRecipients = recipientsToCreate.map((recipient) => ({
    ...recipient,
    email: recipient.email.toLowerCase(),
  }));

  const duplicateRecipients = normalizedRecipients.filter((newRecipient) => {
    const existingRecipient = document.recipients.find(
      (existingRecipient) => existingRecipient.email === newRecipient.email,
    );

    return existingRecipient !== undefined;
  });

  if (duplicateRecipients.length > 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Duplicate recipient(s) found for ${duplicateRecipients.map((recipient) => recipient.email).join(', ')}`,
    });
  }

  const createdRecipients = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      normalizedRecipients.map(async (recipient) => {
        const authOptions = createRecipientAuthOptions({
          accessAuth: recipient.accessAuth || null,
          actionAuth: recipient.actionAuth || null,
        });

        const createdRecipient = await tx.recipient.create({
          data: {
            documentId,
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            token: nanoid(),
            sendStatus: recipient.role === RecipientRole.CC ? SendStatus.SENT : SendStatus.NOT_SENT,
            signingStatus:
              recipient.role === RecipientRole.CC ? SigningStatus.SIGNED : SigningStatus.NOT_SIGNED,
            authOptions,
          },
        });

        // Handle recipient created audit log.
        await tx.documentAuditLog.create({
          data: createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED,
            documentId: documentId,
            metadata: requestMetadata,
            data: {
              recipientEmail: createdRecipient.email,
              recipientName: createdRecipient.name,
              recipientId: createdRecipient.id,
              recipientRole: createdRecipient.role,
              accessAuth: recipient.accessAuth || undefined,
              actionAuth: recipient.actionAuth || undefined,
            },
          }),
        });

        return createdRecipient;
      }),
    );
  });

  return {
    recipients: createdRecipients,
  };
};
