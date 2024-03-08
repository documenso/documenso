import { updateSubscriptionItemQuantity } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { prisma } from '@documenso/prisma';

import { IS_BILLING_ENABLED } from '../../constants/app';

export type AcceptTeamInvitationOptions = {
  userId: number;
  teamId: number;
};

export const acceptTeamInvitation = async ({ userId, teamId }: AcceptTeamInvitationOptions) => {
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
        include: {
          team: {
            include: {
              subscription: true,
            },
          },
        },
      });

      const { team } = teamMemberInvite;

      await tx.teamMember.create({
        data: {
          teamId: teamMemberInvite.teamId,
          userId: user.id,
          role: teamMemberInvite.role,
        },
      });

      await tx.teamMemberInvite.delete({
        where: {
          id: teamMemberInvite.id,
        },
      });

      if (IS_BILLING_ENABLED() && team.subscription) {
        const numberOfSeats = await tx.teamMember.count({
          where: {
            teamId: teamMemberInvite.teamId,
          },
        });

        await updateSubscriptionItemQuantity({
          priceId: team.subscription.priceId,
          subscriptionId: team.subscription.planId,
          quantity: numberOfSeats,
        });
      }
    },
    { timeout: 30_000 },
  );
};
