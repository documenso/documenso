import { DocumentStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type CreateAttachmentOptions = {
  envelopeId: string;
  teamId: number;
  userId: number;
  data: {
    label: string;
    data: string;
  };
};

export const createAttachment = async ({
  envelopeId,
  teamId,
  userId,
  data,
}: CreateAttachmentOptions) => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      team: buildTeamWhereQuery({ teamId, userId }),
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  if (envelope.status === DocumentStatus.COMPLETED || envelope.status === DocumentStatus.REJECTED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Attachments can not be modified after the document has been completed or rejected',
    });
  }

  return await prisma.envelopeAttachment.create({
    data: {
      envelopeId,
      type: 'link',
      ...data,
    },
  });
};
