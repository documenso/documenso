import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberRoles } from '@documenso/lib/server-only/team/get-member-roles';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { buildTeamWhereQuery, isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType, TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { authenticatedProcedure } from '../trpc';
import { ZCreateTeamMembersRequestSchema, ZCreateTeamMembersResponseSchema } from './create-team-members.types';

export const createTeamMembersRoute = authenticatedProcedure
  .input(ZCreateTeamMembersRequestSchema)
  .output(ZCreateTeamMembersResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, organisationMembers } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        teamId,
        organisationMembers,
      },
    });

    return await createTeamMembers({
      userId: user.id,
      teamId,
      membersToCreate: organisationMembers,
    });
  });

type CreateTeamMembersOptions = {
  userId: number;
  teamId: number;
  membersToCreate: {
    organisationMemberId: string;
    teamRole: TeamMemberRole;
  }[];
};

export const createTeamMembers = async ({ userId, teamId, membersToCreate }: CreateTeamMembersOptions) => {
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({
      teamId,
      userId,
      roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
    }),
    include: {
      organisation: {
        include: {
          members: {
            select: {
              id: true,
            },
          },
        },
      },
      teamGroups: {
        where: {
          organisationGroup: {
            type: OrganisationGroupType.INTERNAL_TEAM,
          },
        },
        include: {
          organisationGroup: true,
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found or missing permissions',
    });
  }

  const isMembersPartOfOrganisation = membersToCreate.every((member) =>
    team.organisation.members.some(({ id }) => id === member.organisationMemberId),
  );

  if (!isMembersPartOfOrganisation) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Some member IDs do not exist',
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

  if (!membersToCreate.every((member) => isTeamRoleWithinUserHierarchy(currentUserTeamRole, member.teamRole))) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Cannot add a member with a role higher than your own',
    });
  }

  const teamRoleGroupId = (role: TeamMemberRole) =>
    match(role)
      .with(TeamMemberRole.MEMBER, () => teamMemberGroup.organisationGroupId)
      .with(TeamMemberRole.MANAGER, () => teamManagerGroup.organisationGroupId)
      .with(TeamMemberRole.ADMIN, () => teamAdminGroup.organisationGroupId)
      .exhaustive();

  // Silently drop additions that would duplicate an existing membership in
  // the same internal-team role group (the only case that would hit the
  // (organisationMemberId, groupId) unique constraint). Members who are
  // implicitly part of the team via an INTERNAL_ORGANISATION group are NOT
  // dropped, so this still allows assigning an explicit team role on top
  // of the inherited org-level membership.
  const existingTeamGroupMemberships = await prisma.organisationGroupMember.findMany({
    where: {
      organisationMemberId: {
        in: membersToCreate.map((member) => member.organisationMemberId),
      },
      groupId: {
        in: [
          teamMemberGroup.organisationGroupId,
          teamManagerGroup.organisationGroupId,
          teamAdminGroup.organisationGroupId,
        ],
      },
    },
    select: { organisationMemberId: true, groupId: true },
  });

  const existingPairs = new Set(
    existingTeamGroupMemberships.map(({ organisationMemberId, groupId }) => `${organisationMemberId}:${groupId}`),
  );

  const filteredMembersToCreate = membersToCreate.filter(
    (member) => !existingPairs.has(`${member.organisationMemberId}:${teamRoleGroupId(member.teamRole)}`),
  );

  if (filteredMembersToCreate.length === 0) {
    return;
  }

  await prisma.organisationGroupMember.createMany({
    data: filteredMembersToCreate.map((member) => ({
      id: generateDatabaseId('group_member'),
      organisationMemberId: member.organisationMemberId,
      groupId: teamRoleGroupId(member.teamRole),
    })),
  });
};
