import { z } from 'zod';

import { getCheckoutSession } from '@documenso/ee/server-only/stripe/get-checkout-session';
import { getStripeCustomerIdByUser } from '@documenso/ee/server-only/stripe/get-customer';
import {
  getTeamSeatPriceId,
  isSomeSubscriptionsActiveAndCommunityPlan,
} from '@documenso/lib/utils/billing';
import { prisma } from '@documenso/prisma';
import { Prisma, TeamMemberRole } from '@documenso/prisma/client';

import { IS_BILLING_ENABLED, WEBAPP_BASE_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { stripe } from '../stripe';

export type CreateTeamOptions = {
  /**
   * ID of the user creating the Team.
   */
  userId: number;

  /**
   * Name of the team to display.
   */
  name: string;

  /**
   * Unique URL of the team.
   *
   * Used as the URL path, example: https://documenso.com/t/{teamUrl}/settings
   */
  teamUrl: string;
};

export type CreateTeamResponse =
  | {
      paymentRequired: false;
    }
  | {
      paymentRequired: true;
      checkoutUrl: string;
    };

/**
 * Create a team or pending team depending on the user's subscription or application's billing settings.
 */
export const createTeam = async ({
  name,
  userId,
  teamUrl,
}: CreateTeamOptions): Promise<CreateTeamResponse> => {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
    },
    include: {
      Subscription: true,
    },
  });

  const isUserSubscriptionValidForTeams = isSomeSubscriptionsActiveAndCommunityPlan(
    user.Subscription,
  );

  const isPaymentRequired = IS_BILLING_ENABLED && !isUserSubscriptionValidForTeams;

  try {
    // Create the team directly if no payment is required.
    if (!isPaymentRequired) {
      await prisma.team.create({
        data: {
          name,
          url: teamUrl,
          ownerUserId: user.id,
          members: {
            create: [
              {
                userId,
                role: TeamMemberRole.ADMIN,
              },
            ],
          },
        },
      });

      return {
        paymentRequired: false,
      };
    }

    // Create a pending team if payment is required.
    return await prisma.$transaction(async (tx) => {
      const existingTeamWithUrl = await tx.team.findUnique({
        where: {
          url: teamUrl,
        },
      });

      if (existingTeamWithUrl) {
        throw new AppError(AppErrorCode.ALREADY_EXISTS, 'Team URL already exists.');
      }

      const pendingTeam = await tx.teamPending.create({
        data: {
          name,
          url: teamUrl,
          ownerUserId: user.id,
        },
      });

      const stripeCustomerId = await getStripeCustomerIdByUser(user);

      const stripeCheckoutSession = await getCheckoutSession({
        customerId: stripeCustomerId,
        priceId: getTeamSeatPriceId(),
        returnUrl: `${WEBAPP_BASE_URL}/settings/teams`,
        subscriptionMetadata: {
          pendingTeamId: pendingTeam.id.toString(),
        },
      });

      if (!stripeCheckoutSession) {
        throw new AppError('Unable to create checkout session');
      }

      return {
        paymentRequired: true,
        checkoutUrl: stripeCheckoutSession,
      };
    });
  } catch (err) {
    console.error(err);

    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
      throw err;
    }

    const target = z.array(z.string()).safeParse(err.meta?.target);

    if (err.code === 'P2002' && target.success && target.data.includes('url')) {
      throw new AppError(AppErrorCode.ALREADY_EXISTS, 'Team URL already exists.');
    }

    throw err;
  }
};

export type CreateTeamFromPendingTeamOptions = {
  pendingTeamId: number;
  subscriptionId: string;
};

export const createTeamFromPendingTeam = async ({
  pendingTeamId,
  subscriptionId,
}: CreateTeamFromPendingTeamOptions) => {
  await prisma.$transaction(async (tx) => {
    const pendingTeam = await tx.teamPending.findUniqueOrThrow({
      where: {
        id: pendingTeamId,
      },
    });

    await tx.teamPending.delete({
      where: {
        id: pendingTeamId,
      },
    });

    const team = await tx.team.create({
      data: {
        name: pendingTeam.name,
        url: pendingTeam.url,
        ownerUserId: pendingTeam.ownerUserId,
        subscriptionId,
        members: {
          create: [
            {
              userId: pendingTeam.ownerUserId,
              role: TeamMemberRole.ADMIN,
            },
          ],
        },
      },
    });

    // Attach the team ID to the subscription metadata so we can keep track of it if the team changes ownership.
    await stripe.subscriptions
      .update(subscriptionId, {
        metadata: {
          teamId: team.id.toString(),
        },
      })
      .catch((e) => {
        console.error(e);
        // Non-critical error, but we want to log it so we can rectify it.
        // Todo: Teams - Send alert.
      });
  });
};
