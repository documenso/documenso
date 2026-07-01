import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { mapEnvelopeTagsToTags } from '../../utils/tags';
import { getTeamById } from '../team/get-team';

export type GetEnvelopeTagsOptions = {
  userId: number;
  teamId: number;
  envelopeId: string;
};

export const getEnvelopeTags = async ({ userId, teamId, envelopeId }: GetEnvelopeTagsOptions) => {
  const team = await getTeamById({ userId, teamId });

  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      OR: [
        { userId },
        {
          teamId: team.id,
          visibility: { in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole] },
        },
      ],
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  const envelopeTags = await prisma.envelopeTag.findMany({
    where: { envelopeId },
    include: {
      tag: true,
    },
  });

  return mapEnvelopeTagsToTags(envelopeTags);
};
