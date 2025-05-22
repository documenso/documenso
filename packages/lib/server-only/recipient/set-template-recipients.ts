import type { Recipient } from '@prisma/client';
import { RecipientRole } from '@prisma/client';

import {
  DIRECT_TEMPLATE_RECIPIENT_EMAIL,
  DIRECT_TEMPLATE_RECIPIENT_NAME,
} from '@documenso/lib/constants/direct-templates';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import {
  type TRecipientActionAuthTypes,
  ZRecipientAuthOptionsSchema,
} from '../../types/document-auth';
import { nanoid } from '../../universal/id';
import { createRecipientAuthOptions } from '../../utils/document-auth';
import { buildTeamWhereQuery } from '../../utils/teams';

export type SetTemplateRecipientsOptions = {
  userId: number;
  teamId: number;
  templateId: number;
  recipients: {
    id?: number;
    email: string;
    name: string;
    role: RecipientRole;
    signingOrder?: number | null;
    actionAuth?: TRecipientActionAuthTypes | null;
  }[];
};

export const setTemplateRecipients = async ({
  userId,
  teamId,
  templateId,
  recipients,
}: SetTemplateRecipientsOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      team: buildTeamWhereQuery(teamId, userId),
    },
    include: {
      directLink: true,
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

  if (!template) {
    throw new Error('Template not found');
  }

  const recipientsHaveActionAuth = recipients.some((recipient) => recipient.actionAuth);

  // Check if user has permission to set the global action auth.
  if (recipientsHaveActionAuth && !template.team.organisation.organisationClaim.flags.cfr21) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to set the action auth',
    });
  }

  const normalizedRecipients = recipients.map((recipient) => {
    // Force replace any changes to the name or email of the direct recipient.
    if (template.directLink && recipient.id === template.directLink.directTemplateRecipientId) {
      return {
        ...recipient,
        email: DIRECT_TEMPLATE_RECIPIENT_EMAIL,
        name: DIRECT_TEMPLATE_RECIPIENT_NAME,
      };
    }

    return {
      ...recipient,
      email: recipient.email.toLowerCase(),
    };
  });

  const existingRecipients = await prisma.recipient.findMany({
    where: {
      templateId,
    },
  });

  const removedRecipients = existingRecipients.filter(
    (existingRecipient) =>
      !normalizedRecipients.find(
        (recipient) =>
          recipient.id === existingRecipient.id || recipient.email === existingRecipient.email,
      ),
  );

  if (template.directLink !== null) {
    const updatedDirectRecipient = recipients.find(
      (recipient) => recipient.id === template.directLink?.directTemplateRecipientId,
    );

    const deletedDirectRecipient = removedRecipients.find(
      (recipient) => recipient.id === template.directLink?.directTemplateRecipientId,
    );

    if (updatedDirectRecipient?.role === RecipientRole.CC) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Cannot set direct recipient as CC',
      });
    }

    if (deletedDirectRecipient) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Cannot delete direct recipient while direct template exists',
      });
    }
  }

  const linkedRecipients = normalizedRecipients.map((recipient) => {
    const existing = existingRecipients.find(
      (existingRecipient) =>
        existingRecipient.id === recipient.id || existingRecipient.email === recipient.email,
    );

    return {
      ...recipient,
      _persisted: existing,
    };
  });

  const persistedRecipients = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      linkedRecipients.map(async (recipient) => {
        let authOptions = ZRecipientAuthOptionsSchema.parse(recipient._persisted?.authOptions);

        if (recipient.actionAuth !== undefined) {
          authOptions = createRecipientAuthOptions({
            accessAuth: authOptions.accessAuth,
            actionAuth: recipient.actionAuth,
          });
        }

        const upsertedRecipient = await tx.recipient.upsert({
          where: {
            id: recipient._persisted?.id ?? -1,
            templateId,
          },
          update: {
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            templateId,
            authOptions,
          },
          create: {
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            token: nanoid(),
            templateId,
            authOptions,
          },
        });

        const recipientId = upsertedRecipient.id;

        // Clear all fields if the recipient role is changed to a type that cannot have fields.
        if (
          recipient._persisted &&
          recipient._persisted.role !== recipient.role &&
          (recipient.role === RecipientRole.CC || recipient.role === RecipientRole.VIEWER)
        ) {
          await tx.field.deleteMany({
            where: {
              recipientId,
            },
          });
        }

        return upsertedRecipient;
      }),
    );
  });

  if (removedRecipients.length > 0) {
    await prisma.recipient.deleteMany({
      where: {
        id: {
          in: removedRecipients.map((recipient) => recipient.id),
        },
      },
    });
  }

  // Filter out recipients that have been removed or have been updated.
  const filteredRecipients: Recipient[] = existingRecipients.filter((recipient) => {
    const isRemoved = removedRecipients.find(
      (removedRecipient) => removedRecipient.id === recipient.id,
    );
    const isUpdated = persistedRecipients.find(
      (persistedRecipient) => persistedRecipient.id === recipient.id,
    );

    return !isRemoved && !isUpdated;
  });

  return {
    recipients: [...filteredRecipients, ...persistedRecipients],
  };
};
