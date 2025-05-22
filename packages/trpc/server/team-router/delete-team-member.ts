import { OrganisationGroupType } from '@prisma/client';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberRoles } from '@documenso/lib/server-only/team/get-member-roles';
import { buildTeamWhereQuery, isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteTeamMemberRequestSchema,
  ZDeleteTeamMemberResponseSchema,
} from './delete-team-member.types';

export const deleteTeamMemberRoute = authenticatedProcedure
  // .meta(deleteTeamMemberMeta)
  .input(ZDeleteTeamMemberRequestSchema)
  .output(ZDeleteTeamMemberResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { teamId, memberId } = input;
    const { user } = ctx;

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery(teamId, user.id, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM']),
      include: {
        teamGroups: {
          where: {
            organisationGroup: {
              type: OrganisationGroupType.INTERNAL_TEAM,
              organisationGroupMembers: {
                some: {
                  organisationMember: {
                    id: memberId,
                  },
                },
              },
            },
          },
          include: {
            organisationGroup: {
              include: {
                organisationGroupMembers: {
                  include: {
                    organisationMember: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    const { teamRole: currentUserTeamRole } = await getMemberRoles({
      teamId,
      reference: {
        type: 'User',
        id: user.id,
      },
    });

    const { teamRole: currentMemberToDeleteTeamRole } = await getMemberRoles({
      teamId,
      reference: {
        type: 'Member',
        id: memberId,
      },
    });

    // Check role permissions.
    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, currentMemberToDeleteTeamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot remove a member with a higher role',
      });
    }

    const teamGroupToRemoveMemberFrom = team.teamGroups[0];

    // Sanity check.
    if (team.teamGroups.length !== 1) {
      console.error('Team has more than one internal team group. This should not happen.');
      // Todo: Logging.
    }

    if (team.teamGroups.length === 0) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Team has no internal team groups',
      });
    }

    await prisma.organisationGroupMember.delete({
      where: {
        organisationMemberId_groupId: {
          organisationMemberId: memberId,
          groupId: teamGroupToRemoveMemberFrom.organisationGroupId,
        },
      },
    });
  });
