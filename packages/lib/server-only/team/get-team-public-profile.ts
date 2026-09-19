import { prisma } from '@documenso/prisma';
import type { TeamProfile } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';

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
    where: buildTeamWhereQuery({ teamId, userId }),
    include: {
      profile: true,
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  // Lazily initialize a disabled public profile on first access. Membership is
  // already verified by the query above, so this system initialization does not
  // impose the MANAGE_TEAM gate that updateTeamPublicProfile enforces for writes.
  if (!team.profile) {
    const profile = await prisma.teamProfile.upsert({
      where: {
        teamId,
      },
      create: {
        teamId,
        enabled: false,
      },
      update: {},
    });

    return {
      profile,
      url: team.url,
    };
  }

  return {
    profile: team.profile,
    url: team.url,
  };
};
