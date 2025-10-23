import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type UpdateAttachmentOptions = {
  id: string;
  userId: number;
  teamId: number;
  label?: string;
  data?: string;
};

export const updateAttachment = async ({
  id,
  teamId,
  userId,
  label,
  data,
}: UpdateAttachmentOptions) => {
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

  return await prisma.envelopeAttachment.update({
    where: {
      id,
    },
    data: {
      label,
      data,
    },
  });
};
