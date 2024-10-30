import { z } from 'zod';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@documenso/prisma/client';
import type { DocumentVisibility } from '@documenso/prisma/client';

export type UpdateTeamOptions = {
  userId: number;
  teamId: number;
  data: {
    name?: string;
    url?: string;
    documentVisibility?: DocumentVisibility;
    includeSenderDetails?: boolean;
  };
};

export const updateTeam = async ({ userId, teamId, data }: UpdateTeamOptions) => {
  try {
    await prisma.$transaction(async (tx) => {
      const foundPendingTeamWithUrl = await tx.teamPending.findFirst({
        where: {
          url: data.url,
        },
      });

      if (foundPendingTeamWithUrl) {
        throw new AppError(AppErrorCode.ALREADY_EXISTS, 'Team URL already exists.');
      }

      const team = await tx.team.update({
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
          url: data.url,
          name: data.name,
          teamGlobalSettings: {
            update: {
              documentVisibility: data.documentVisibility,
              includeSenderDetails: data.includeSenderDetails,
            },
          },
        },
      });

      return team;
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
