import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type DeleteAttachmentOptions = {
  id: string;
  userId: number;
  teamId: number;
};

export const deleteAttachment = async ({ id, userId, teamId }: DeleteAttachmentOptions) => {
  const attachment = await prisma.envelopeAttachment.findFirst({
    where: {
      id,
      envelope: {
        team: buildTeamWhereQuery({ teamId, userId }),
      },
    },
  });

  if (!attachment) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Attachment not found',
    });
  }

  await prisma.envelopeAttachment.delete({
    where: {
      id,
    },
  });
};
