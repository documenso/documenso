import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';

export type DeleteTeamMemberInvitationsOptions = {
  /**
   * The ID of the user who is initiating this action.
   */
  userId: number;

  /**
   * The ID of the team to remove members from.
   */
  teamId: number;

  /**
   * The IDs of the invitations to remove.
   */
  invitationIds: number[];
};

export const deleteTeamMemberInvitations = async ({
  userId,
  teamId,
  invitationIds,
}: DeleteTeamMemberInvitationsOptions) => {
  await prisma.$transaction(async (tx) => {
    await tx.teamMember.findFirstOrThrow({
      where: {
        userId,
        teamId,
        role: {
          in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
        },
      },
    });

    await tx.teamMemberInvite.deleteMany({
      where: {
        id: {
          in: invitationIds,
        },
        teamId,
      },
    });
  });
};
