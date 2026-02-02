import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type FindAttachmentsByEnvelopeIdOptions = {
  envelopeId: string;
  userId: number;
  teamId: number;
};

export const findAttachmentsByEnvelopeId = async ({
  envelopeId,
  userId,
  teamId,
}: FindAttachmentsByEnvelopeIdOptions) => {
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

  return await prisma.envelopeAttachment.findMany({
    where: {
      envelopeId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
};
