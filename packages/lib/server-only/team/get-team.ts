import type { Prisma } from '@prisma/client';
import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TeamEmailSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamEmailSchema';
import { TeamGlobalSettingsSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamGlobalSettingsSchema';
import { TeamMemberSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamMemberSchema';
import { TeamSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type GetTeamByIdOptions = {
  userId?: number;
  teamId: number;
};

export const ZGetTeamByIdResponseSchema = TeamSchema.extend({
  teamEmail: TeamEmailSchema.nullable(),
  teamGlobalSettings: TeamGlobalSettingsSchema.nullable(),
  currentTeamMember: TeamMemberSchema.pick({
    role: true,
  }).nullable(),
});

export type TGetTeamByIdResponse = z.infer<typeof ZGetTeamByIdResponseSchema>;

/**
 * Get a team given a teamId.
 *
 * Provide an optional userId to check that the user is a member of the team.
 */
export const getTeamById = async ({
  userId,
  teamId,
}: GetTeamByIdOptions): Promise<TGetTeamByIdResponse> => {
  const whereFilter: Prisma.TeamWhereUniqueInput = {
    id: teamId,
  };

  if (userId !== undefined) {
    whereFilter['members'] = {
      some: {
        userId,
      },
    };
  }

  const result = await prisma.team.findUniqueOrThrow({
    where: whereFilter,
    include: {
      teamEmail: true,
      teamGlobalSettings: true,
      members: {
        where: {
          userId,
        },
        select: {
          role: true,
        },
      },
    },
  });

  const { members, ...team } = result;

  return {
    ...team,
    currentTeamMember: userId !== undefined ? members[0] : null,
  };
};

export type GetTeamByUrlOptions = {
  userId: number;
  teamUrl: string;
};

export type TGetTeamByUrlResponse = Awaited<ReturnType<typeof getTeamByUrl>>;

/**
 * Get a team given a team URL.
 */
export const getTeamByUrl = async ({ userId, teamUrl }: GetTeamByUrlOptions) => {
  const whereFilter: Prisma.TeamWhereUniqueInput = {
    url: teamUrl,
  };

  if (userId !== undefined) {
    whereFilter['members'] = {
      some: {
        userId,
      },
    };
  }

  const result = await prisma.team.findFirst({
    where: whereFilter,
    include: {
      teamEmail: true,
      emailVerification: {
        select: {
          expiresAt: true,
          name: true,
          email: true,
        },
      },
      transferVerification: {
        select: {
          expiresAt: true,
          name: true,
          email: true,
        },
      },
      subscription: true,
      teamGlobalSettings: true,
      members: {
        where: {
          userId,
        },
        select: {
          role: true,
        },
      },
    },
  });

  if (!result) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const { members, ...team } = result;

  return {
    ...team,
    currentTeamMember: members[0],
  };
};
