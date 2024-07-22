import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { prisma } from '@documenso/prisma';
import type { Recipient } from '@documenso/prisma/client';
import { RecipientRole } from '@documenso/prisma/client';

import {
  DIRECT_TEMPLATE_RECIPIENT_EMAIL,
  DIRECT_TEMPLATE_RECIPIENT_NAME,
} from '../../constants/template';
import { AppError, AppErrorCode } from '../../errors/app-error';
import {
  type TRecipientActionAuthTypes,
  ZRecipientAuthOptionsSchema,
} from '../../types/document-auth';
import { nanoid } from '../../universal/id';
import { createRecipientAuthOptions } from '../../utils/document-auth';

export type SetRecipientsForTemplateOptions = {
  userId: number;
  teamId?: number;
  templateId: number;
  recipients: {
    id?: number;
    email: string;
    name: string;
    role: RecipientRole;
    actionAuth?: TRecipientActionAuthTypes | null;
  }[];
};

export const setRecipientsForTemplate = async ({
  userId,
  teamId,
  templateId,
  recipients,
}: SetRecipientsForTemplateOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      OR: [
        {
          userId,
        },
        {
          team: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
      ],
    },
    include: {
      directLink: true,
    },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const recipientsHaveActionAuth = recipients.some((recipient) => recipient.actionAuth);

  // Check if user has permission to set the global action auth.
  if (recipientsHaveActionAuth) {
    const isDocumentEnterprise = await isUserEnterprise({
      userId,
      teamId,
    });

    if (!isDocumentEnterprise) {
      throw new AppError(
        AppErrorCode.UNAUTHORIZED,
        'You do not have permission to set the action auth',
      );
    }
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
      throw new AppError(AppErrorCode.INVALID_BODY, 'Cannot set direct recipient as CC');
    }

    if (deletedDirectRecipient) {
      throw new AppError(
        AppErrorCode.INVALID_BODY,
        'Cannot delete direct recipient while direct template exists',
      );
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
            templateId,
            authOptions,
          },
          create: {
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
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

  return [...filteredRecipients, ...persistedRecipients];
};
