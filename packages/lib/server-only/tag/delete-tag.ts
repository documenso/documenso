import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamById } from '../team/get-team';

export type DeleteTagOptions = {
  userId: number;
  teamId: number;
  tagId: string;
};

export const deleteTag = async ({ userId, teamId, tagId }: DeleteTagOptions) => {
  await getTeamById({ userId, teamId });

  const tag = await prisma.tag.findFirst({
    where: {
      id: tagId,
      team: buildTeamWhereQuery({ teamId, userId }),
    },
  });

  if (!tag) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Tag not found',
    });
  }

  return await prisma.tag.delete({
    where: {
      id: tag.id,
    },
  });
};
