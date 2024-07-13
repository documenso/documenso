import { prisma } from '@documenso/prisma';

export type DeclineTeamInvitationOptions = {
  userId: number;
  teamId: number;
};

export const declineTeamInvitation = async ({ userId, teamId }: DeclineTeamInvitationOptions) => {
  await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findFirstOrThrow({
        where: {
          id: userId,
        },
      });

      const teamMemberInvite = await tx.teamMemberInvite.findFirstOrThrow({
        where: {
          teamId,
          email: user.email,
        },
      });

      // Delete the invitation
      await tx.teamMemberInvite.delete({
        where: {
          id: teamMemberInvite.id,
        },
      });

      // TODO: notify the team owner/sender
    },
    { timeout: 30_000 },
  );
};
