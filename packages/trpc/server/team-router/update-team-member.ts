import { match } from 'ts-pattern';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberRoles } from '@documenso/lib/server-only/team/get-member-roles';
import { buildTeamWhereQuery, isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType, TeamMemberRole } from '@documenso/prisma/generated/types';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateTeamMemberRequestSchema,
  ZUpdateTeamMemberResponseSchema,
} from './update-team-member.types';

export const updateTeamMemberRoute = authenticatedProcedure
  //   .meta(updateTeamMemberMeta)
  .input(ZUpdateTeamMemberRequestSchema)
  .output(ZUpdateTeamMemberResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { teamId, memberId, data } = input;
    const userId = ctx.user.id;

    const team = await prisma.team.findFirst({
      where: {
        AND: [
          buildTeamWhereQuery(teamId, userId, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM']),
          {
            organisation: {
              members: {
                some: {
                  id: memberId,
                },
              },
            },
          },
        ],
      },
      include: {
        teamGroups: {
          where: {
            organisationGroup: {
              type: OrganisationGroupType.INTERNAL_TEAM,
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
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Team not found' });
    }

    const internalTeamGroupToRemoveMemberFrom = team.teamGroups.find(
      (group) =>
        group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
        group.teamId === teamId &&
        group.organisationGroup.organisationGroupMembers.some(
          (member) => member.organisationMemberId === memberId,
        ),
    );

    if (!internalTeamGroupToRemoveMemberFrom) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Unable to find member role.',
      });
    }

    const teamMemberGroup = team.teamGroups.find(
      (group) =>
        group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
        group.teamId === teamId &&
        group.teamRole === TeamMemberRole.MEMBER,
    );

    const teamManagerGroup = team.teamGroups.find(
      (group) =>
        group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
        group.teamId === teamId &&
        group.teamRole === TeamMemberRole.MANAGER,
    );

    const teamAdminGroup = team.teamGroups.find(
      (group) =>
        group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
        group.teamId === teamId &&
        group.teamRole === TeamMemberRole.ADMIN,
    );

    if (!teamMemberGroup || !teamManagerGroup || !teamAdminGroup) {
      console.error({
        message: 'Team groups not found.',
        teamMemberGroup: Boolean(teamMemberGroup),
        teamManagerGroup: Boolean(teamManagerGroup),
        teamAdminGroup: Boolean(teamAdminGroup),
      });

      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Team groups not found.',
      });
    }

    const { teamRole: currentUserTeamRole } = await getMemberRoles({
      teamId,
      reference: {
        type: 'User',
        id: userId,
      },
    });

    const { teamRole: currentMemberToUpdateTeamRole } = await getMemberRoles({
      teamId,
      reference: {
        type: 'Member',
        id: memberId,
      },
    });

    // Check role permissions.
    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, currentMemberToUpdateTeamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot update a member with a higher role',
      });
    }

    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, data.role)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot update a member to a role higher than your own',
      });
    }

    // Switch member to new internal team group role.
    await prisma.$transaction(async (tx) => {
      await tx.organisationGroupMember.delete({
        where: {
          organisationMemberId_groupId: {
            organisationMemberId: memberId,
            groupId: internalTeamGroupToRemoveMemberFrom.organisationGroupId,
          },
        },
      });

      await tx.organisationGroupMember.create({
        data: {
          organisationMemberId: memberId,
          groupId: match(data.role)
            .with(TeamMemberRole.MEMBER, () => teamMemberGroup.organisationGroupId)
            .with(TeamMemberRole.MANAGER, () => teamManagerGroup.organisationGroupId)
            .with(TeamMemberRole.ADMIN, () => teamAdminGroup.organisationGroupId)
            .exhaustive(),
        },
      });
    });
  });
