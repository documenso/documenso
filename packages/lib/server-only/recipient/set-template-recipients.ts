import type { Recipient } from '@prisma/client';
import { EnvelopeType, RecipientRole } from '@prisma/client';

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
import { type EnvelopeIdOptions, mapSecondaryIdToTemplateId } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type SetTemplateRecipientsOptions = {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  recipients: {
    id?: number;
    email: string;
    name: string;
    role: RecipientRole;
    signingOrder?: number | null;
    actionAuth?: TRecipientActionAuthTypes[];
  }[];
};

export const setTemplateRecipients = async ({
  userId,
  teamId,
  id,
  recipients,
}: SetTemplateRecipientsOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
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
      recipients: true,
    },
  });

  if (!envelope) {
    throw new Error('Template not found');
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

  const normalizedRecipients = recipients.map((recipient) => {
    // Force replace any changes to the name or email of the direct recipient.
    if (envelope.directLink && recipient.id === envelope.directLink.directTemplateRecipientId) {
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

  const existingRecipients = envelope.recipients;

  const removedRecipients = existingRecipients.filter(
    (existingRecipient) =>
      !normalizedRecipients.find((recipient) => recipient.id === existingRecipient.id),
  );

  if (envelope.directLink !== null) {
    const updatedDirectRecipient = recipients.find(
      (recipient) => recipient.id === envelope.directLink?.directTemplateRecipientId,
    );

    const deletedDirectRecipient = removedRecipients.find(
      (recipient) => recipient.id === envelope.directLink?.directTemplateRecipientId,
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
      (existingRecipient) => existingRecipient.id === recipient.id,
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
            envelopeId: envelope.id,
          },
          update: {
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            envelopeId: envelope.id,
            authOptions,
          },
          create: {
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            token: nanoid(),
            envelopeId: envelope.id,
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
    recipients: [...filteredRecipients, ...persistedRecipients].map((recipient) => ({
      ...recipient,
      documentId: null,
      templateId: mapSecondaryIdToTemplateId(envelope.secondaryId),
    })),
  };
};
