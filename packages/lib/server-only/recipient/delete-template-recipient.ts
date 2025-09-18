import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface DeleteTemplateRecipientOptions {
  userId: number;
  teamId: number;
  recipientId: number;
}

export const deleteTemplateRecipient = async ({
  userId,
  teamId,
  recipientId,
}: DeleteTemplateRecipientOptions): Promise<void> => {
  const recipientToDelete = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      envelope: {
        type: EnvelopeType.TEMPLATE,
        team: buildTeamWhereQuery({ teamId, userId }),
      },
    },
  });

  if (!recipientToDelete) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'envelopeId',
      id: recipientToDelete.envelopeId,
    },
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  if (!recipientToDelete || recipientToDelete.id !== recipientId) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  await prisma.recipient.delete({
    where: {
      id: recipientId,
      envelope: envelopeWhereInput,
    },
  });
};
