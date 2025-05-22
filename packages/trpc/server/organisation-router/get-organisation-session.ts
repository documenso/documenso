import { getHighestOrganisationRoleInGroup } from '@documenso/lib/utils/organisations';
import { getHighestTeamRoleInGroup } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import type { TGetOrganisationSessionResponse } from './get-organisation-session.types';
import { ZGetOrganisationSessionResponseSchema } from './get-organisation-session.types';

/**
 * Get all the organisations and teams a user belongs to.
 */
export const getOrganisationSessionRoute = authenticatedProcedure
  .output(ZGetOrganisationSessionResponseSchema)
  .query(async ({ ctx }) => {
    return await getOrganisationSession({ userId: ctx.user.id });
  });

export const getOrganisationSession = async ({
  userId,
}: {
  userId: number;
}): Promise<TGetOrganisationSessionResponse> => {
  const organisations = await prisma.organisation.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      organisationClaim: true,
      subscription: true,
      groups: {
        where: {
          organisationGroupMembers: {
            some: {
              organisationMember: {
                userId,
              },
            },
          },
        },
      },
      teams: {
        where: {
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
            include: {
              organisationGroup: true,
            },
          },
        },
      },
    },
  });

  return organisations.map((organisation) => {
    return {
      ...organisation,
      teams: organisation.teams.map((team) => ({
        ...team,
        currentTeamRole: getHighestTeamRoleInGroup(team.teamGroups),
      })),
      currentOrganisationRole: getHighestOrganisationRoleInGroup(organisation.groups),
    };
  });
};
