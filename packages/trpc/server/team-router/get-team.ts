import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  buildTeamWhereQuery,
  extractDerivedTeamSettings,
  getHighestTeamRoleInGroup,
} from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZGetTeamRequestSchema, ZGetTeamResponseSchema } from './get-team.types';

export const getTeamRoute = authenticatedProcedure
  //   .meta(getTeamMeta)
  .input(ZGetTeamRequestSchema)
  .output(ZGetTeamResponseSchema)
  .query(async ({ input, ctx }) => {
    return await getTeam({
      teamReference: input.teamReference,
      userId: ctx.user.id,
    });
  });

/**
 * Get a team by its ID or URL.
 *
 * Todo: orgs there's multiple implementations of this.
 */
export const getTeam = async ({
  teamReference,
  userId,
}: {
  teamReference: number | string;
  userId: number;
}) => {
  const team = await prisma.team.findFirst({
    where: {
      id: typeof teamReference === 'number' ? teamReference : undefined,
      url: typeof teamReference === 'string' ? teamReference : undefined,
      ...buildTeamWhereQuery(undefined, userId),
    },
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
      teamGlobalSettings: true,
      organisation: {
        include: {
          organisationGlobalSettings: true,
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  const organisationSettings = team.organisation.organisationGlobalSettings;
  const teamSettings = team.teamGlobalSettings;

  return {
    ...team,
    currentTeamRole: getHighestTeamRoleInGroup(team.teamGroups),
    teamSettings,
    derivedSettings: extractDerivedTeamSettings(organisationSettings, teamSettings),
  };
};
