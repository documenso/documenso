import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import type { TTagType } from '../../types/tag-type';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamSettings } from '../team/get-team-settings';

export type CreateTagOptions = {
  userId: number;
  teamId: number;
  name: string;
  type: TTagType;
};

export const createTag = async ({ userId, teamId, name, type }: CreateTagOptions) => {
  // This indirectly verifies whether the user has access to the team.
  await getTeamSettings({ userId, teamId });

  const normalizedName = name.trim().replace(/\s+/g, ' ');
  const normalizedNameKey = normalizedName.toLowerCase();

  if (!normalizedName) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Tag name cannot be empty',
    });
  }

  const existing = await prisma.tag.findFirst({
    where: {
      teamId,
      normalizedName: normalizedNameKey,
      type,
      team: buildTeamWhereQuery({ teamId, userId }),
    },
  });

  if (existing) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, {
      message: 'A tag with this name already exists for this type',
    });
  }

  return await prisma.tag.create({
    data: {
      name: normalizedName,
      normalizedName: normalizedNameKey,
      type,
      teamId,
    },
  });
};
