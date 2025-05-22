import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberRoles } from '@documenso/lib/server-only/team/get-member-roles';
import { buildTeamWhereQuery, isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType, OrganisationMemberRole } from '@documenso/prisma/generated/types';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteTeamGroupRequestSchema,
  ZDeleteTeamGroupResponseSchema,
} from './delete-team-group.types';

export const deleteTeamGroupRoute = authenticatedProcedure
  // .meta(deleteTeamGroupMeta)
  .input(ZDeleteTeamGroupRequestSchema)
  .output(ZDeleteTeamGroupResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamGroupId, teamId } = input;
    const { user } = ctx;

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery(teamId, user.id, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM']),
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    const group = await prisma.teamGroup.findFirst({
      where: {
        id: teamGroupId,
        team: {
          id: teamId,
        },
      },
      include: {
        organisationGroup: true,
      },
    });

    if (!group) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Team group not found',
      });
    }

    // You cannot delete internal organisation groups.
    // The only exception is deleting the "member" organisation group which is used to allow
    // all organisation members to access a team.
    if (
      group.organisationGroup.type === OrganisationGroupType.INTERNAL_ORGANISATION &&
      group.organisationGroup.organisationRole !== OrganisationMemberRole.MEMBER
    ) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to delete internal organisaion groups',
      });
    }

    const { teamRole: currentUserTeamRole } = await getMemberRoles({
      teamId,
      reference: {
        type: 'User',
        id: user.id,
      },
    });

    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, group.teamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to delete this team group',
      });
    }

    await prisma.teamGroup.delete({
      where: {
        id: teamGroupId,
        teamId,
      },
    });
  });
