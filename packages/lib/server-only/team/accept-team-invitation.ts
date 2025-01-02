import { TeamMemberInviteStatus } from '@prisma/client';

import { updateSubscriptionItemQuantity } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';

import { jobs } from '../../jobs/client';

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
          status: {
            not: TeamMemberInviteStatus.DECLINED,
          },
        },
        include: {
          team: {
            include: {
              subscription: true,
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (teamMemberInvite.status === TeamMemberInviteStatus.ACCEPTED) {
        const memberExists = await tx.teamMember.findFirst({
          where: {
            teamId: teamMemberInvite.teamId,
            userId: user.id,
          },
        });

        if (memberExists) {
          return;
        }
      }

      const { team } = teamMemberInvite;

      const teamMember = await tx.teamMember.create({
        data: {
          teamId: teamMemberInvite.teamId,
          userId: user.id,
          role: teamMemberInvite.role,
        },
      });

      await tx.teamMemberInvite.update({
        where: {
          id: teamMemberInvite.id,
        },
        data: {
          status: TeamMemberInviteStatus.ACCEPTED,
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

      await jobs.triggerJob({
        name: 'send.team-member-joined.email',
        payload: {
          teamId: teamMember.teamId,
          memberId: teamMember.id,
        },
      });
    },
    { timeout: 30_000 },
  );
};
