import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type CreateAttachmentOptions = {
  envelopeId: string;
  teamId: number;
  userId: number;
  label: string;
  data: string;
};

export const createAttachment = async ({
  envelopeId,
  teamId,
  userId,
  label,
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

  return await prisma.envelopeAttachment.create({
    data: {
      envelopeId,
      type: 'link',
      label,
      data,
    },
  });
};
