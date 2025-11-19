import { DocumentStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@doku-seal/lib/errors/app-error';
import { prisma } from '@doku-seal/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type UpdateAttachmentOptions = {
  id: string;
  userId: number;
  teamId: number;
  data: { label?: string; data?: string };
};

export const updateAttachment = async ({ id, teamId, userId, data }: UpdateAttachmentOptions) => {
  const attachment = await prisma.envelopeAttachment.findFirst({
    where: {
      id,
      envelope: {
        team: buildTeamWhereQuery({ teamId, userId }),
      },
    },
    include: {
      envelope: true,
    },
  });

  if (!attachment) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Attachment not found',
    });
  }

  if (
    attachment.envelope.status === DocumentStatus.COMPLETED ||
    attachment.envelope.status === DocumentStatus.REJECTED
  ) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Attachments can not be modified after the document has been completed or rejected',
    });
  }

  return await prisma.envelopeAttachment.update({
    where: {
      id,
    },
    data,
  });
};
