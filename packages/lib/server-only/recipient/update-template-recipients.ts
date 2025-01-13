import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import type { TRecipientAccessAuthTypes } from '@documenso/lib/types/document-auth';
import {
  type TRecipientActionAuthTypes,
  ZRecipientAuthOptionsSchema,
} from '@documenso/lib/types/document-auth';
import { createRecipientAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import { RecipientRole } from '@documenso/prisma/client';
import { SendStatus, SigningStatus } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface UpdateTemplateRecipientsOptions {
  userId: number;
  teamId?: number;
  templateId: number;
  recipients: {
    id: number;
    email?: string;
    name?: string;
    role?: RecipientRole;
    signingOrder?: number | null;
    accessAuth?: TRecipientAccessAuthTypes | null;
    actionAuth?: TRecipientActionAuthTypes | null;
  }[];
}

export const updateTemplateRecipients = async ({
  userId,
  teamId,
  templateId,
  recipients,
}: UpdateTemplateRecipientsOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
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

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

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

  const recipientsToUpdate = recipients.map((recipient) => {
    const originalRecipient = template.recipients.find(
      (existingRecipient) => existingRecipient.id === recipient.id,
    );

    if (!originalRecipient) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Recipient with id ${recipient.id} not found`,
      });
    }

    const duplicateRecipientWithSameEmail = template.recipients.find(
      (existingRecipient) =>
        existingRecipient.email === recipient.email && existingRecipient.id !== recipient.id,
    );

    if (duplicateRecipientWithSameEmail) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Duplicate recipient with the same email found: ${duplicateRecipientWithSameEmail.email}`,
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
            templateId,
          },
          data: {
            name: mergedRecipient.name,
            email: mergedRecipient.email,
            role: mergedRecipient.role,
            signingOrder: mergedRecipient.signingOrder,
            templateId,
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

        return updatedRecipient;
      }),
    );
  });

  return {
    recipients: updatedRecipients,
  };
};
