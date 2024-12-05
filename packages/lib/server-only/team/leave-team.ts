import { updateSubscriptionItemQuantity } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';

import { jobs } from '../../jobs/client';

export type LeaveTeamOptions = {
  /**
   * The ID of the user who is leaving the team.
   */
  userId: number;

  /**
   * The ID of the team the user is leaving.
   */
  teamId: number;
};

export const leaveTeam = async ({ userId, teamId }: LeaveTeamOptions): Promise<void> => {
  await prisma.$transaction(
    async (tx) => {
      const team = await tx.team.findFirstOrThrow({
        where: {
          id: teamId,
          ownerUserId: {
            not: userId,
          },
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          subscription: true,
        },
      });

      const leavingUser = await tx.user.findUniqueOrThrow({
        where: { id: userId },
      });

      await tx.teamMember.delete({
        where: {
          userId_teamId: {
            userId,
            teamId,
          },
          team: {
            ownerUserId: {
              not: userId,
            },
          },
        },
      });

      if (IS_BILLING_ENABLED() && team.subscription) {
        const numberOfSeats = await tx.teamMember.count({
          where: {
            teamId,
          },
        });

        await updateSubscriptionItemQuantity({
          priceId: team.subscription.priceId,
          subscriptionId: team.subscription.planId,
          quantity: numberOfSeats,
        });
      }

      await jobs.triggerJob({
        name: 'send.team-member-left.email',
        payload: {
          teamId,
          memberUserId: leavingUser.id,
        },
      });
    },
    { timeout: 30_000 },
  );
};
