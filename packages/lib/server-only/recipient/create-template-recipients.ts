import { RecipientRole } from '@prisma/client';
import { SendStatus, SigningStatus } from '@prisma/client';

import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import type { TRecipientAccessAuthTypes } from '@documenso/lib/types/document-auth';
import { type TRecipientActionAuthTypes } from '@documenso/lib/types/document-auth';
import { nanoid } from '@documenso/lib/universal/id';
import { createRecipientAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface CreateTemplateRecipientsOptions {
  userId: number;
  teamId?: number;
  templateId: number;
  recipients: {
    email: string;
    name: string;
    role: RecipientRole;
    signingOrder?: number | null;
    accessAuth?: TRecipientAccessAuthTypes | null;
    actionAuth?: TRecipientActionAuthTypes | null;
  }[];
}

export const createTemplateRecipients = async ({
  userId,
  teamId,
  templateId,
  recipients: recipientsToCreate,
}: CreateTemplateRecipientsOptions) => {
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
    const existingRecipient = template.recipients.find(
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
            templateId,
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

        return createdRecipient;
      }),
    );
  });

  return {
    recipients: createdRecipients,
  };
};
