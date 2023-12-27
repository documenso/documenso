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
  await prisma.$transaction(async (tx) => {
    const teamTransferVerification = await tx.teamTransferVerification.findFirstOrThrow({
      where: {
        token,
      },
      include: {
        team: true,
      },
    });

    const { team, userId: newOwnerUserId } = teamTransferVerification;

    await tx.teamTransferVerification.deleteMany({
      where: {
        teamId: team.id,
      },
    });

    const newOwnerUser = await tx.user.findFirstOrThrow({
      where: {
        id: newOwnerUserId,
      },
      include: {
        Subscription: true,
      },
    });

    let newTeamSubscription: Stripe.Subscription | null = null;

    if (IS_BILLING_ENABLED) {
      newTeamSubscription = await transferTeamSubscription({
        user: newOwnerUser,
        team,
      });
    }

    if (newTeamSubscription) {
      await tx.subscription.upsert(
        mapStripeSubscriptionToPrismaUpsertAction(newOwnerUser.id, newTeamSubscription),
      );
    }

    await tx.team.update({
      where: {
        id: team.id,
        members: {
          some: {
            userId: newOwnerUserId,
          },
        },
      },
      data: {
        ownerUserId: newOwnerUserId,
        subscriptionId: newTeamSubscription?.id ?? null,
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
  });
};
