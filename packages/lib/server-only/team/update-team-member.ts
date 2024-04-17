import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import type { TeamMemberRole } from '@documenso/prisma/client';

export type UpdateTeamMemberOptions = {
  userId: number;
  teamId: number;
  teamMemberId: number;
  data: {
    role: TeamMemberRole;
  };
};

export const updateTeamMember = async ({
  userId,
  teamId,
  teamMemberId,
  data,
}: UpdateTeamMemberOptions) => {
  await prisma.$transaction(async (tx) => {
    // Find the team and validate that the user is allowed to update members.
    const team = await tx.team.findFirstOrThrow({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
            role: {
              in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
            },
          },
        },
      },
      include: {
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
          },
        },
      },
    });

    const currentTeamMember = team.members.find((member) => member.userId === userId);
    const teamMemberToUpdate = team.members.find((member) => member.id === teamMemberId);

    if (!teamMemberToUpdate || !currentTeamMember) {
      throw new AppError(AppErrorCode.NOT_FOUND, 'Team member does not exist');
    }

    if (teamMemberToUpdate.userId === team.ownerUserId) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, 'Cannot update the owner');
    }

    const isMemberToUpdateHigherRole = !isTeamRoleWithinUserHierarchy(
      currentTeamMember.role,
      teamMemberToUpdate.role,
    );

    if (isMemberToUpdateHigherRole) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, 'Cannot update a member with a higher role');
    }

    const isNewMemberRoleHigherThanCurrentRole = !isTeamRoleWithinUserHierarchy(
      currentTeamMember.role,
      data.role,
    );

    if (isNewMemberRoleHigherThanCurrentRole) {
      throw new AppError(
        AppErrorCode.UNAUTHORIZED,
        'Cannot give a member a role higher than the user initating the update',
      );
    }

    return await tx.teamMember.update({
      where: {
        id: teamMemberId,
        teamId,
        userId: {
          not: team.ownerUserId,
        },
      },
      data: {
        role: data.role,
      },
    });
  });
};
