import type { Recipient } from '@prisma/client';
import { RecipientRole } from '@prisma/client';
import { SendStatus, SigningStatus } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { TRecipientAccessAuthTypes } from '@documenso/lib/types/document-auth';
import {
  type TRecipientActionAuthTypes,
  ZRecipientAuthOptionsSchema,
} from '@documenso/lib/types/document-auth';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import {
  createDocumentAuditLogData,
  diffRecipientChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { createRecipientAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canRecipientBeModified } from '../../utils/recipients';
import { getDocumentWhereInput } from '../document/get-document-by-id';

export interface UpdateDocumentRecipientsOptions {
  userId: number;
  teamId: number;
  documentId: number;
  recipients: RecipientData[];
  requestMetadata: ApiRequestMetadata;
}

export const updateDocumentRecipients = async ({
  userId,
  teamId,
  documentId,
  recipients,
  requestMetadata,
}: UpdateDocumentRecipientsOptions) => {
  const { documentWhereInput } = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
    include: {
      fields: true,
      recipients: true,
      team: {
        select: {
          organisation: {
            select: {
              organisationClaim: true,
            },
          },
        },
      },
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

  const recipientsHaveActionAuth = recipients.some((recipient) => recipient.actionAuth);

  // Check if user has permission to set the global action auth.
  if (recipientsHaveActionAuth && !document.team.organisation.organisationClaim.flags.cfr21) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to set the action auth',
    });
  }

  const recipientsToUpdate = recipients.map((recipient) => {
    const originalRecipient = document.recipients.find(
      (existingRecipient) => existingRecipient.id === recipient.id,
    );

    if (!originalRecipient) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Recipient with id ${recipient.id} not found`,
      });
    }

    const duplicateRecipientWithSameEmail = document.recipients.find(
      (existingRecipient) =>
        existingRecipient.email === recipient.email && existingRecipient.id !== recipient.id,
    );

    if (duplicateRecipientWithSameEmail) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Duplicate recipient with the same email found: ${duplicateRecipientWithSameEmail.email}`,
      });
    }

    if (
      hasRecipientBeenChanged(originalRecipient, recipient) &&
      !canRecipientBeModified(originalRecipient, document.fields)
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Cannot modify a recipient who has already interacted with the document',
      });
    }

    return {
      originalRecipient,
      updateData: recipient,
    };
  });

  const updatedRecipients = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      recipientsToUpdate.map(async ({ originalRecipient, updateData }) => {
        let authOptions = ZRecipientAuthOptionsSchema.parse(originalRecipient.authOptions);

        if (updateData.actionAuth !== undefined || updateData.accessAuth !== undefined) {
          authOptions = createRecipientAuthOptions({
            accessAuth: updateData.accessAuth || authOptions.accessAuth,
            actionAuth: updateData.actionAuth || authOptions.actionAuth,
          });
        }

        const mergedRecipient = {
          ...originalRecipient,
          ...updateData,
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
            fields: true,
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
              metadata: requestMetadata,
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

  const newRecipientAccessAuth = newRecipientData.accessAuth || null;
  const newRecipientActionAuth = newRecipientData.actionAuth || null;

  return (
    recipient.email !== newRecipientData.email ||
    recipient.name !== newRecipientData.name ||
    recipient.role !== newRecipientData.role ||
    recipient.signingOrder !== newRecipientData.signingOrder ||
    authOptions.accessAuth !== newRecipientAccessAuth ||
    authOptions.actionAuth !== newRecipientActionAuth
  );
};
