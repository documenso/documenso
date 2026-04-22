import { OrganisationMemberInviteStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getHighestOrganisationRoleInGroup } from '@documenso/lib/utils/organisations';
import { getHighestTeamRoleInGroup } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import { ZGetAdminTeamRequestSchema, ZGetAdminTeamResponseSchema } from './get-admin-team.types';

export const getAdminTeamRoute = adminProcedure
  .input(ZGetAdminTeamRequestSchema)
  .output(ZGetAdminTeamResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId } = input;

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      include: {
        organisation: {
          select: {
            id: true,
            name: true,
            url: true,
            ownerUserId: true,
          },
        },
        teamEmail: true,
        teamGlobalSettings: true,
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Team not found',
      });
    }

    const [teamMembers, pendingInvites] = await Promise.all([
      prisma.organisationMember.findMany({
        where: {
          organisationId: team.organisationId,
          organisationGroupMembers: {
            some: {
              group: {
                teamGroups: {
                  some: {
                    teamId,
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          userId: true,
          createdAt: true,
          organisationGroupMembers: {
            include: {
              group: {
                include: {
                  teamGroups: {
                    where: {
                      teamId,
                    },
                  },
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      // Invites are organisation-scoped in the schema (no team relation), so this is intentionally
      // all pending invites for the team's parent organisation.
      prisma.organisationMemberInvite.findMany({
        where: {
          organisationId: team.organisationId,
          status: OrganisationMemberInviteStatus.PENDING,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
          organisationRole: true,
          status: true,
        },
      }),
    ]);

    const mappedTeamMembers = teamMembers.map((teamMember) => {
      const groups = teamMember.organisationGroupMembers.map(({ group }) => group);

      return {
        id: teamMember.id,
        userId: teamMember.userId,
        createdAt: teamMember.createdAt,
        user: teamMember.user,
        teamRole: getHighestTeamRoleInGroup(groups.flatMap((group) => group.teamGroups)),
        organisationRole: getHighestOrganisationRoleInGroup(groups),
      };
    });

    return {
      ...team,
      memberCount: mappedTeamMembers.length,
      teamMembers: mappedTeamMembers,
      pendingInvites,
    };
  });
