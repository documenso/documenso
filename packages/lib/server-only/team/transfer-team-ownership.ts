import { TeamMemberRole } from '@prisma/client';

import { transferTeamSubscription } from '@documenso/ee-stub/server-only/stripe/transfer-team-subscription';
import { mapStripeSubscriptionToPrismaUpsertAction } from '@documenso/ee-stub/server-only/stripe/webhook/on-subscription-updated';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';

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

      await Promise.all([
        tx.teamTransferVerification.updateMany({
          where: {
            teamId: team.id,
          },
          data: {
            completed: true,
          },
        }),
        tx.teamTransferVerification.deleteMany({
          where: {
            teamId: team.id,
            expiresAt: {
              lt: new Date(),
            },
          },
        }),
      ]);

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
          subscriptions: true,
        },
      });

      let teamSubscription: unknown = null;

      if (IS_BILLING_ENABLED()) {
        teamSubscription = await transferTeamSubscription({
          user: newOwnerUser,
          teamId: team.id,
          clearPaymentMethods: teamTransferVerification.clearPaymentMethods,
        });
      }

      if (teamSubscription) {
        const subscriptionData = mapStripeSubscriptionToPrismaUpsertAction(
          teamSubscription,
          undefined,
          team.id,
        );

        await tx.subscription.upsert({
          where: {
            planId: 'team_plan',
          },
          create: {
            planId: 'team_plan',
            priceId: subscriptionData.priceId,
            status: 'ACTIVE',
            teamId: team.id,
            cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
            createdAt: subscriptionData.created,
            updatedAt: subscriptionData.updated,
            periodEnd: subscriptionData.currentPeriodEnd,
          },
          update: {
            priceId: subscriptionData.priceId,
            status: 'ACTIVE',
            cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
            updatedAt: subscriptionData.updated,
            periodEnd: subscriptionData.currentPeriodEnd,
          },
        });
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
