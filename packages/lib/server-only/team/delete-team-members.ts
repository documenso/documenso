import { updateSubscriptionItemQuantity } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { prisma } from '@documenso/prisma';

import { IS_BILLING_ENABLED } from '../../constants/app';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { getTeamSeatPriceId } from '../../utils/billing';

export type DeleteTeamMembersOptions = {
  /**
   * The ID of the user who is initiating this action.
   */
  userId: number;

  /**
   * The ID of the team to remove members from.
   */
  teamId: number;

  /**
   * The IDs of the team members to remove.
   */
  teamMemberIds: number[];
};

export const deleteTeamMembers = async ({
  userId,
  teamId,
  teamMemberIds,
}: DeleteTeamMembersOptions) => {
  await prisma.$transaction(async (tx) => {
    // Find the team and validate that the user is allowed to remove members.
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
    });

    // Remove the team members.
    await tx.teamMember.deleteMany({
      where: {
        id: {
          in: teamMemberIds,
        },
        teamId,
        userId: {
          not: team.ownerUserId,
        },
      },
    });

    if (IS_BILLING_ENABLED && team.subscriptionId) {
      const numberOfSeats = await tx.teamMember.count({
        where: {
          teamId,
        },
      });

      await updateSubscriptionItemQuantity({
        priceId: getTeamSeatPriceId(),
        subscriptionId: team.subscriptionId,
        quantity: numberOfSeats,
      });
    }
  });
};
