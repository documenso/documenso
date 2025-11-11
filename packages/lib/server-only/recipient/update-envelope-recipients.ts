import { EnvelopeType, RecipientRole, SendStatus, SigningStatus } from '@prisma/client';

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
import { extractLegacyIds } from '../../universal/id';
import { type EnvelopeIdOptions } from '../../utils/envelope';
import { mapFieldToLegacyField } from '../../utils/fields';
import { canRecipientBeModified } from '../../utils/recipients';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface UpdateEnvelopeRecipientsOptions {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  recipients: {
    id: number;
    email?: string;
    name?: string;
    role?: RecipientRole;
    signingOrder?: number | null;
    accessAuth?: TRecipientAccessAuthTypes[];
    actionAuth?: TRecipientActionAuthTypes[];
  }[];
  requestMetadata: ApiRequestMetadata;
}

export const updateEnvelopeRecipients = async ({
  userId,
  teamId,
  id,
  recipients,
  requestMetadata,
}: UpdateEnvelopeRecipientsOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: null,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
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

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  if (envelope.completedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Envelope already complete',
    });
  }

  const recipientsHaveActionAuth = recipients.some(
    (recipient) => recipient.actionAuth && recipient.actionAuth.length > 0,
  );

  // Check if user has permission to set the global action auth.
  if (recipientsHaveActionAuth && !envelope.team.organisation.organisationClaim.flags.cfr21) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to set the action auth',
    });
  }

  const recipientsToUpdate = recipients.map((recipient) => {
    const originalRecipient = envelope.recipients.find(
      (existingRecipient) => existingRecipient.id === recipient.id,
    );

    if (!originalRecipient) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Recipient with id ${recipient.id} not found`,
      });
    }

    if (!canRecipientBeModified(originalRecipient, envelope.fields)) {
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
            envelopeId: envelope.id,
          },
          data: {
            name: mergedRecipient.name,
            email: mergedRecipient.email,
            role: mergedRecipient.role,
            signingOrder: mergedRecipient.signingOrder,
            envelopeId: envelope.id,
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

        // Handle recipient updated audit log.
        if (envelope.type === EnvelopeType.DOCUMENT) {
          const changes = diffRecipientChanges(originalRecipient, updatedRecipient);

          if (changes.length > 0) {
            await tx.documentAuditLog.create({
              data: createDocumentAuditLogData({
                type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED,
                envelopeId: envelope.id,
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
        }

        return updatedRecipient;
      }),
    );
  });

  return {
    recipients: updatedRecipients.map((recipient) => ({
      ...recipient,
      ...extractLegacyIds(envelope),
      fields: recipient.fields.map((field) => mapFieldToLegacyField(field, envelope)),
    })),
  };
};
