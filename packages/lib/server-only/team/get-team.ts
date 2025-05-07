import { TeamMemberRole } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TeamEmailSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamEmailSchema';
import { TeamSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery, getHighestTeamRoleInGroup } from '../../utils/teams';

export type GetTeamByIdOptions = {
  userId: number;
  teamId: number;
};

export const ZGetTeamByIdResponseSchema = TeamSchema.extend({
  teamEmail: TeamEmailSchema.nullable(),
  currentTeamRole: z.nativeEnum(TeamMemberRole),
});

export type TGetTeamByIdResponse = z.infer<typeof ZGetTeamByIdResponseSchema>;

export const getTeamById = async ({
  userId,
  teamId,
}: GetTeamByIdOptions): Promise<TGetTeamByIdResponse> => {
  // Todo: orgs test
  const result = await prisma.team.findFirst({
    where: buildTeamWhereQuery(teamId, userId),
    include: {
      teamEmail: true,
      teamGroups: {
        where: {
          organisationGroup: {
            organisationGroupMembers: {
              some: {
                organisationMember: {
                  userId,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!result) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  const { teamGroups, ...team } = result;

  return {
    ...team,
    currentTeamRole: getHighestTeamRoleInGroup(teamGroups),
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
  const result = await prisma.team.findFirst({
    where: {
      url: teamUrl,
      teamGroups: {
        some: {
          organisationGroup: {
            organisationGroupMembers: {
              some: {
                organisationMember: {
                  userId,
                },
              },
            },
          },
        },
      },
    },
    include: {
      teamEmail: true,
      emailVerification: {
        select: {
          expiresAt: true,
          name: true,
          email: true,
        },
      },
      teamGroups: {
        where: {
          organisationGroup: {
            organisationGroupMembers: {
              some: {
                organisationMember: {
                  userId,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!result) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const { teamGroups, ...team } = result;

  return {
    ...team,
    currentTeamRole: getHighestTeamRoleInGroup(teamGroups),
  };
};
