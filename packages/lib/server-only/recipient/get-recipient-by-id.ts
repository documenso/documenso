import { EnvelopeType } from '@prisma/client';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { mapSecondaryIdToDocumentId, mapSecondaryIdToTemplateId } from '../../utils/envelope';
import { buildTeamWhereQuery } from '../../utils/teams';

export type GetRecipientByIdOptions = {
  recipientId: number;
  userId: number;
  teamId: number;
  type: EnvelopeType;
};

/**
 * Get a recipient by ID. This will also return the recipient signing token so
 * be careful when using this.
 */
export const getRecipientById = async ({
  recipientId,
  userId,
  teamId,
  type,
}: GetRecipientByIdOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      envelope: {
        type,
        team: buildTeamWhereQuery({ teamId, userId }),
      },
    },
    include: {
      fields: true,
      envelope: {
        select: {
          secondaryId: true,
        },
      },
    },
  });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  const legacyId = match(type)
    .with(EnvelopeType.DOCUMENT, () => ({
      documentId: mapSecondaryIdToDocumentId(recipient.envelope.secondaryId),
    }))
    .with(EnvelopeType.TEMPLATE, () => ({
      templateId: mapSecondaryIdToTemplateId(recipient.envelope.secondaryId),
    }))
    .exhaustive();

  // Backwards compatibility mapping.
  return {
    ...recipient,
    ...legacyId,

    // eslint-disable-next-line unused-imports/no-unused-vars
    fields: recipient.fields.map((field) => ({
      ...field,
      ...legacyId,
    })),
  };
};
