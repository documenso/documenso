import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/generated/types';
import { TeamSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';

import { getHighestTeamRoleInGroup } from '../../utils/teams';

export type GetTeamsOptions = {
  userId: number;
  teamId?: number;
};

export const ZGetTeamsResponseSchema = TeamSchema.extend({
  teamRole: z.nativeEnum(TeamMemberRole),
}).array();

export type TGetTeamsResponse = z.infer<typeof ZGetTeamsResponseSchema>;

export const getTeams = async ({ userId, teamId }: GetTeamsOptions) => {
  let whereQuery: Prisma.TeamWhereInput = {
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
  };

  if (teamId) {
    whereQuery = {
      teamGroups: {
        some: {
          teamId,
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
    };
  }

  const teams = await prisma.team.findMany({
    where: whereQuery,
    include: {
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

  return teams.map((team) => ({
    ...team,
    currentTeamRole: getHighestTeamRoleInGroup(team.teamGroups),
  }));
};
