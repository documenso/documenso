import { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { Prisma } from '@documenso/prisma/client';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';

export type UpdateTeamOptions = {
  userId: number;
  teamId: number;
  data: {
    name?: string;
    url?: string;
  };
};

export const updateTeam = async ({ userId, teamId, data }: UpdateTeamOptions) => {
  try {
    return await prisma.team.update({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
            role: {
              in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
            },
          },
        },
      },
      data: {
        ...data,
      },
    });
  } catch (err) {
    console.error(err);

    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
      throw err;
    }

    const target = z.array(z.string()).safeParse(err.meta?.target);

    if (err.code === 'P2002' && target.success && target.data.includes('url')) {
      throw new AppError(AppErrorCode.ALREADY_EXISTS, 'Team URL already exists.');
    }

    throw err;
  }
};
