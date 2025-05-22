import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';

export type GetRecipientByIdOptions = {
  recipientId: number;
  userId: number;
  teamId: number;
};

/**
 * Get a recipient by ID. This will also return the recipient signing token so
 * be careful when using this.
 */
export const getRecipientById = async ({
  recipientId,
  userId,
  teamId,
}: GetRecipientByIdOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      document: {
        team: buildTeamWhereQuery(teamId, userId),
      },
    },
    include: {
      fields: true,
    },
  });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  return recipient;
};
