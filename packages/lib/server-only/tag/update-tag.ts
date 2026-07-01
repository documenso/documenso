import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamById } from '../team/get-team';

export type UpdateTagOptions = {
  userId: number;
  teamId: number;
  tagId: string;
  data: {
    name?: string;
  };
};

export const updateTag = async ({ userId, teamId, tagId, data }: UpdateTagOptions) => {
  const { name } = data;

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

  if (name !== undefined) {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const normalizedNameKey = normalizedName.toLowerCase();

    if (!normalizedName) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Tag name cannot be empty',
      });
    }

    if (normalizedNameKey !== tag.normalizedName) {
      const existing = await prisma.tag.findFirst({
        where: {
          teamId,
          normalizedName: normalizedNameKey,
          type: tag.type,
          id: { not: tagId },
        },
      });

      if (existing) {
        throw new AppError(AppErrorCode.ALREADY_EXISTS, {
          message: 'A tag with this name already exists for this type',
        });
      }
    }

    return await prisma.tag.update({
      where: { id: tagId },
      data: {
        name: normalizedName,
        normalizedName: normalizedNameKey,
      },
    });
  }

  return tag;
};
