import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';

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
              in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['UPDATE_TEAM_MEMBERS'],
            },
          },
        },
      },
    });

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
