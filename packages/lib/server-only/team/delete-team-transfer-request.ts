import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';

export type DeleteTeamTransferRequestOptions = {
  /**
   * The ID of the user deleting the transfer.
   */
  userId: number;

  /**
   * The ID of the team whose team transfer request should be deleted.
   */
  teamId: number;
};

export const deleteTeamTransferRequest = async ({
  userId,
  teamId,
}: DeleteTeamTransferRequestOptions) => {
  await prisma.$transaction(async (tx) => {
    await tx.team.findFirstOrThrow({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
            role: {
              in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['DELETE_TEAM_TRANSFER_REQUEST'],
            },
          },
        },
      },
    });

    await tx.teamTransferVerification.delete({
      where: {
        teamId,
      },
    });
  });
};
