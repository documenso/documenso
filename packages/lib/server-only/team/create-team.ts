import { Prisma, TeamMemberRole } from '@prisma/client';
import type Stripe from 'stripe';
import { z } from 'zod';

import { createTeamCustomer } from '@documenso/ee/server-only/stripe/create-team-customer';
import { getTeamRelatedPrices } from '@documenso/ee/server-only/stripe/get-team-related-prices';
import { mapStripeSubscriptionToPrismaUpsertAction } from '@documenso/ee/server-only/stripe/webhook/on-subscription-updated';
import { isDocumentPlatform as isUserPlatformPlan } from '@documenso/ee/server-only/util/is-document-platform';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { subscriptionsContainsActivePlan } from '@documenso/lib/utils/billing';
import { prisma } from '@documenso/prisma';

import { stripe } from '../stripe';

export type CreateTeamOptions = {
  /**
   * ID of the user creating the Team.
   */
  userId: number;

  /**
   * Name of the team to display.
   */
  teamName: string;

  /**
   * Unique URL of the team.
   *
   * Used as the URL path, example: https://documenso.com/t/{teamUrl}/settings
   */
  teamUrl: string;
};

export const ZCreateTeamResponseSchema = z.union([
  z.object({
    paymentRequired: z.literal(false),
  }),
  z.object({
    paymentRequired: z.literal(true),
    pendingTeamId: z.number(),
  }),
]);

export type TCreateTeamResponse = z.infer<typeof ZCreateTeamResponseSchema>;

/**
 * Create a team or pending team depending on the user's subscription or application's billing settings.
 */
export const createTeam = async ({
  userId,
  teamName,
  teamUrl,
}: CreateTeamOptions): Promise<TCreateTeamResponse> => {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
    },
    include: {
      subscriptions: true,
    },
  });

  const isPlatformPlan = await isUserPlatformPlan({
    userId: user.id,
    teamId: null,
  });

  let isPaymentRequired = IS_BILLING_ENABLED();
  let customerId: string | null = null;

  if (IS_BILLING_ENABLED()) {
    const teamRelatedPriceIds = await getTeamRelatedPrices().then((prices) =>
      prices.map((price) => price.id),
    );

    const hasTeamRelatedSubscription = subscriptionsContainsActivePlan(
      user.subscriptions,
      teamRelatedPriceIds,
    );

    if (isPlatformPlan) {
      // For platform users, check if they already have any teams
      const existingTeams = await prisma.team.findMany({
        where: {
          ownerUserId: userId,
        },
      });

      // Payment is required if they already have any team
      isPaymentRequired = existingTeams.length > 0;
    } else {
      // For non-platform users, payment is required if they don't have a team-related subscription
      isPaymentRequired = !hasTeamRelatedSubscription;
    }

    customerId = await createTeamCustomer({
      name: user.name ?? teamName,
      email: user.email,
    }).then((customer) => customer.id);
  }

  try {
    // Create the team directly if no payment is required.
    if (!isPaymentRequired) {
      await prisma.$transaction(async (tx) => {
        const existingUserProfileWithUrl = await tx.user.findUnique({
          where: {
            url: teamUrl,
          },
          select: {
            id: true,
          },
        });

        if (existingUserProfileWithUrl) {
          throw new AppError(AppErrorCode.ALREADY_EXISTS, {
            message: 'URL already taken.',
          });
        }

        const team = await tx.team.create({
          data: {
            name: teamName,
            url: teamUrl,
            ownerUserId: user.id,
            customerId,
            members: {
              create: [
                {
                  userId: user.id,
                  role: TeamMemberRole.ADMIN,
                },
              ],
            },
          },
        });

        await tx.teamGlobalSettings.upsert({
          where: {
            teamId: team.id,
          },
          update: {},
          create: {
            teamId: team.id,
          },
        });
      });

      return {
        paymentRequired: false,
      };
    }

    // Create a pending team if payment is required.
    const pendingTeam = await prisma.$transaction(async (tx) => {
      const existingTeamWithUrl = await tx.team.findUnique({
        where: {
          url: teamUrl,
        },
      });

      const existingUserProfileWithUrl = await tx.user.findUnique({
        where: {
          url: teamUrl,
        },
        select: {
          id: true,
        },
      });

      if (existingUserProfileWithUrl) {
        throw new AppError(AppErrorCode.ALREADY_EXISTS, {
          message: 'URL already taken.',
        });
      }

      if (existingTeamWithUrl) {
        throw new AppError(AppErrorCode.ALREADY_EXISTS, {
          message: 'Team URL already exists.',
        });
      }

      if (!customerId) {
        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Missing customer ID for pending teams.',
        });
      }

      return await tx.teamPending.create({
        data: {
          name: teamName,
          url: teamUrl,
          ownerUserId: user.id,
          customerId,
        },
      });
    });

    return {
      paymentRequired: true,
      pendingTeamId: pendingTeam.id,
    };
  } catch (err) {
    console.error(err);

    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
      throw err;
    }

    const target = z.array(z.string()).safeParse(err.meta?.target);

    if (err.code === 'P2002' && target.success && target.data.includes('url')) {
      throw new AppError(AppErrorCode.ALREADY_EXISTS, {
        message: 'Team URL already exists.',
      });
    }

    throw err;
  }
};

export type CreateTeamFromPendingTeamOptions = {
  pendingTeamId: number;
  subscription: Stripe.Subscription;
};

export const createTeamFromPendingTeam = async ({
  pendingTeamId,
  subscription,
}: CreateTeamFromPendingTeamOptions) => {
  const createdTeam = await prisma.$transaction(async (tx) => {
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
        customerId: pendingTeam.customerId,
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

    await tx.teamGlobalSettings.upsert({
      where: {
        teamId: team.id,
      },
      update: {},
      create: {
        teamId: team.id,
      },
    });

    await tx.subscription.upsert(
      mapStripeSubscriptionToPrismaUpsertAction(subscription, undefined, team.id),
    );

    return team;
  });

  // Attach the team ID to the subscription metadata for sanity reasons.
  await stripe.subscriptions
    .update(subscription.id, {
      metadata: {
        teamId: createdTeam.id.toString(),
      },
    })
    .catch((e) => {
      console.error(e);
      // Non-critical error, but we want to log it so we can rectify it.
      // Todo: Teams - Alert us.
    });

  return createdTeam;
};
