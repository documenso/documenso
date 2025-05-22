import {
  ALLOWED_TEAM_GROUP_TYPES,
  TEAM_MEMBER_ROLE_PERMISSIONS_MAP,
} from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberRoles } from '@documenso/lib/server-only/team/get-member-roles';
import { buildTeamWhereQuery, isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import {
  OrganisationGroupType,
  OrganisationMemberRole,
  TeamMemberRole,
} from '@documenso/prisma/generated/types';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateTeamGroupsRequestSchema,
  ZCreateTeamGroupsResponseSchema,
} from './create-team-groups.types';

export const createTeamGroupsRoute = authenticatedProcedure
  // .meta(createTeamGroupsMeta)
  .input(ZCreateTeamGroupsRequestSchema)
  .output(ZCreateTeamGroupsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, groups } = input;
    const { user } = ctx;

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery(teamId, user.id, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM']),
      include: {
        organisation: {
          include: {
            groups: {
              include: {
                teamGroups: true,
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

    const isValid = groups.every((group) => {
      const organisationGroup = team.organisation.groups.find(
        ({ id }) => id === group.organisationGroupId,
      );

      // Only allow specific organisation groups to be used as a reference for team groups.
      if (!organisationGroup?.type || !ALLOWED_TEAM_GROUP_TYPES.includes(organisationGroup.type)) {
        return false;
      }

      // The "EVERYONE" organisation group can only have the "TEAM MEMBER" role for now.
      if (
        organisationGroup.type === OrganisationGroupType.INTERNAL_ORGANISATION &&
        organisationGroup.organisationRole === OrganisationMemberRole.MEMBER &&
        group.teamRole !== TeamMemberRole.MEMBER
      ) {
        return false;
      }

      // Check that the group is not already added to the team.
      if (organisationGroup.teamGroups.some((teamGroup) => teamGroup.teamId === teamId)) {
        return false;
      }

      // Check that the user has permission to add the group to the team.
      if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, group.teamRole)) {
        return false;
      }

      return true;
    });

    if (!isValid) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Invalid groups',
      });
    }

    await prisma.teamGroup.createMany({
      data: groups.map((group) => ({
        teamId,
        organisationGroupId: group.organisationGroupId,
        teamRole: group.teamRole,
      })),
    });
  });
