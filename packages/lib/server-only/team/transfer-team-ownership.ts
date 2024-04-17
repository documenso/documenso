import type Stripe from 'stripe';

import { transferTeamSubscription } from '@documenso/ee/server-only/stripe/transfer-team-subscription';
import { mapStripeSubscriptionToPrismaUpsertAction } from '@documenso/ee/server-only/stripe/webhook/on-subscription-updated';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';

export type TransferTeamOwnershipOptions = {
  token: string;
};

export const transferTeamOwnership = async ({ token }: TransferTeamOwnershipOptions) => {
  await prisma.$transaction(
    async (tx) => {
      const teamTransferVerification = await tx.teamTransferVerification.findFirstOrThrow({
        where: {
          token,
        },
        include: {
          team: {
            include: {
              subscription: true,
            },
          },
        },
      });

      const { team, userId: newOwnerUserId } = teamTransferVerification;

      await tx.teamTransferVerification.delete({
        where: {
          teamId: team.id,
        },
      });

      const newOwnerUser = await tx.user.findFirstOrThrow({
        where: {
          id: newOwnerUserId,
          teamMembers: {
            some: {
              teamId: team.id,
            },
          },
        },
        include: {
          Subscription: true,
        },
      });

      let teamSubscription: Stripe.Subscription | null = null;

      if (IS_BILLING_ENABLED()) {
        teamSubscription = await transferTeamSubscription({
          user: newOwnerUser,
          team,
          clearPaymentMethods: teamTransferVerification.clearPaymentMethods,
        });
      }

      if (teamSubscription) {
        await tx.subscription.upsert(
          mapStripeSubscriptionToPrismaUpsertAction(teamSubscription, undefined, team.id),
        );
      }

      await tx.team.update({
        where: {
          id: team.id,
        },
        data: {
          ownerUserId: newOwnerUserId,
          members: {
            update: {
              where: {
                userId_teamId: {
                  teamId: team.id,
                  userId: newOwnerUserId,
                },
              },
              data: {
                role: TeamMemberRole.ADMIN,
              },
            },
          },
        },
      });
    },
    { timeout: 30_000 },
  );
};
