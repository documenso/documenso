import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { AppError } from '../../errors/app-error';
import { sendTeamMemberInviteEmail } from './create-team-member-invites';

export type ResendTeamMemberInvitationOptions = {
  /**
   * The ID of the user who is initiating this action.
   */
  userId: number;

  /**
   * The name of hte user who is initiating this action.
   */
  userName: string;

  /**
   * The ID of the team.
   */
  teamId: number;

  /**
   * The IDs of the invitations to resend.
   */
  invitationId: number;
};

/**
 * Resend an email for a given team member invite.
 */
export const resendTeamMemberInvitation = async ({
  userId,
  userName,
  teamId,
  invitationId,
}: ResendTeamMemberInvitationOptions) => {
  await prisma.$transaction(async (tx) => {
    const team = await tx.team.findUniqueOrThrow({
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
    });

    if (!team) {
      throw new AppError('TeamNotFound', 'User is not a member of the team.');
    }

    const teamMemberInvite = await tx.teamMemberInvite.findUniqueOrThrow({
      where: {
        id: invitationId,
        teamId,
      },
    });

    if (!teamMemberInvite) {
      throw new AppError('InviteNotFound', 'No invite exists for this user.');
    }

    await sendTeamMemberInviteEmail({
      email: teamMemberInvite.email,
      token: teamMemberInvite.token,
      teamName: team.name,
      teamUrl: team.url,
      senderName: userName,
    });
  });
};
