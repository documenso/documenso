import { z } from 'zod';

import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { TRecipientAccessAuthTypes } from '@documenso/lib/types/document-auth';
import {
  type TRecipientActionAuthTypes,
  ZRecipientAuthOptionsSchema,
} from '@documenso/lib/types/document-auth';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import {
  createDocumentAuditLogData,
  diffRecipientChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { createRecipientAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import type { Recipient } from '@documenso/prisma/client';
import { RecipientRole } from '@documenso/prisma/client';
import { SendStatus, SigningStatus } from '@documenso/prisma/client';
import { ZRecipientResponseSchema } from '@documenso/trpc/server/recipient-router/schema';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canRecipientBeModified } from '../../utils/recipients';

export interface UpdateDocumentRecipientsOptions {
  userId: number;
  documentId: number;
  recipients: RecipientData[];
  requestMetadata: RequestMetadata;
}

export const ZUpdateDocumentRecipientsResponseSchema = z.object({
  recipients: ZRecipientResponseSchema.array(),
});

export type TUpdateDocumentRecipientsResponse = z.infer<
  typeof ZUpdateDocumentRecipientsResponseSchema
>;

export const updateDocumentRecipients = async ({
  userId,
  documentId,
  recipients,
  requestMetadata,
}: UpdateDocumentRecipientsOptions): Promise<TUpdateDocumentRecipientsResponse> => {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      OR: [
        {
          team: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
        {
          userId,
          teamId: null,
        },
      ],
    },
    include: {
      Field: true,
      Recipient: true,
      team: true,
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

  const team = document?.team ?? undefined;
  const teamId = team?.id ?? undefined;

  const recipientsHaveActionAuth = recipients.some((recipient) => recipient.actionAuth);

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

  const recipientsToUpdate = recipients.map((rawRecipient) => {
    const recipient = {
      ...rawRecipient,
      email: rawRecipient.email?.toLowerCase(),
    };

    const originalRecipient = document.Recipient.find(
      (existingRecipient) => existingRecipient.id === recipient.id,
    );

    if (!originalRecipient) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Recipient with id ${recipient.id} not found`,
      });
    }

    if (
      hasRecipientBeenChanged(originalRecipient, recipient) &&
      !canRecipientBeModified(originalRecipient, document.Field)
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Cannot modify a recipient who has already interacted with the document',
      });
    }

    return {
      originalRecipient,
      recipientUpdateData: recipient,
    };
  });

  const updatedRecipients = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      recipientsToUpdate.map(async ({ originalRecipient, recipientUpdateData }) => {
        let authOptions = ZRecipientAuthOptionsSchema.parse(originalRecipient.authOptions);

        if (
          recipientUpdateData.actionAuth !== undefined ||
          recipientUpdateData.accessAuth !== undefined
        ) {
          authOptions = createRecipientAuthOptions({
            accessAuth: recipientUpdateData.accessAuth || authOptions.accessAuth,
            actionAuth: recipientUpdateData.actionAuth || authOptions.actionAuth,
          });
        }

        const mergedRecipient = {
          ...originalRecipient,
          ...recipientUpdateData,
        };

        const updatedRecipient = await tx.recipient.update({
          where: {
            id: originalRecipient.id,
            documentId,
          },
          data: {
            name: mergedRecipient.name,
            email: mergedRecipient.email,
            role: mergedRecipient.role,
            signingOrder: mergedRecipient.signingOrder,
            documentId,
            sendStatus:
              mergedRecipient.role === RecipientRole.CC ? SendStatus.SENT : SendStatus.NOT_SENT,
            signingStatus:
              mergedRecipient.role === RecipientRole.CC
                ? SigningStatus.SIGNED
                : SigningStatus.NOT_SIGNED,
            authOptions,
          },
          include: {
            Field: true,
          },
        });

        // Clear all fields if the recipient role is changed to a type that cannot have fields.
        if (
          originalRecipient.role !== updatedRecipient.role &&
          (updatedRecipient.role === RecipientRole.CC ||
            updatedRecipient.role === RecipientRole.VIEWER)
        ) {
          await tx.field.deleteMany({
            where: {
              recipientId: updatedRecipient.id,
            },
          });
        }

        const changes = diffRecipientChanges(originalRecipient, updatedRecipient);

        // Handle recipient updated audit log.
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
                recipientEmail: updatedRecipient.email,
                recipientName: updatedRecipient.name,
                recipientId: updatedRecipient.id,
                recipientRole: updatedRecipient.role,
                changes,
              },
            }),
          });
        }

        return updatedRecipient;
      }),
    );
  });

  return {
    recipients: updatedRecipients,
  };
};

/**
 * If you change this you MUST update the `hasRecipientBeenChanged` function.
 */
type RecipientData = {
  id: number;
  email?: string;
  name?: string;
  role?: RecipientRole;
  signingOrder?: number | null;
  accessAuth?: TRecipientAccessAuthTypes | null;
  actionAuth?: TRecipientActionAuthTypes | null;
};

const hasRecipientBeenChanged = (recipient: Recipient, newRecipientData: RecipientData) => {
  const authOptions = ZRecipientAuthOptionsSchema.parse(recipient.authOptions);

  return (
    recipient.email !== newRecipientData.email ||
    recipient.name !== newRecipientData.name ||
    recipient.role !== newRecipientData.role ||
    recipient.signingOrder !== newRecipientData.signingOrder ||
    authOptions.accessAuth !== newRecipientData.accessAuth ||
    authOptions.actionAuth !== newRecipientData.actionAuth
  );
};
