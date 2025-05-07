import type { TeamProfile } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';
import { updateTeamPublicProfile } from './update-team-public-profile';

export type GetTeamPublicProfileOptions = {
  userId: number;
  teamId: number;
};

type GetTeamPublicProfileResponse = {
  profile: TeamProfile;
  url: string | null;
};

export const getTeamPublicProfile = async ({
  userId,
  teamId,
}: GetTeamPublicProfileOptions): Promise<GetTeamPublicProfileResponse> => {
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery(teamId, userId),
    include: {
      profile: true,
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  // Create and return the public profile.
  if (!team.profile) {
    const { url, profile } = await updateTeamPublicProfile({
      userId: userId,
      teamId,
      data: {
        enabled: false,
      },
    });

    if (!profile) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Failed to create public profile',
      });
    }

    return {
      profile,
      url,
    };
  }

  return {
    profile: team.profile,
    url: team.url,
  };
};
