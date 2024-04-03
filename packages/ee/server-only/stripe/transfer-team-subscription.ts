import type Stripe from 'stripe';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { stripe } from '@documenso/lib/server-only/stripe';
import { subscriptionsContainsActivePlan } from '@documenso/lib/utils/billing';
import { prisma } from '@documenso/prisma';
import { type Subscription, type Team, type User } from '@documenso/prisma/client';

import { deleteCustomerPaymentMethods } from './delete-customer-payment-methods';
import { getTeamPrices } from './get-team-prices';
import { getTeamRelatedPriceIds } from './get-team-related-prices';

type TransferStripeSubscriptionOptions = {
  /**
   * The user to transfer the subscription to.
   */
  user: User & { Subscription: Subscription[] };

  /**
   * The team the subscription is associated with.
   */
  team: Team & { subscription?: Subscription | null };

  /**
   * Whether to clear any current payment methods attached to the team.
   */
  clearPaymentMethods: boolean;
};

/**
 * Transfer the Stripe Team seats subscription from one user to another.
 *
 * Will create a new subscription for the new owner and cancel the old one.
 *
 * Returns the subscription that should be associated with the team, null if
 * no subscription is needed (for early adopter plan).
 */
export const transferTeamSubscription = async ({
  user,
  team,
  clearPaymentMethods,
}: TransferStripeSubscriptionOptions) => {
  const teamCustomerId = team.customerId;

  if (!teamCustomerId) {
    throw new AppError(AppErrorCode.NOT_FOUND, 'Missing customer ID.');
  }

  const [teamRelatedPlanPriceIds, teamSeatPrices] = await Promise.all([
    getTeamRelatedPriceIds(),
    getTeamPrices(),
  ]);

  const teamSubscriptionRequired = !subscriptionsContainsActivePlan(
    user.Subscription,
    teamRelatedPlanPriceIds,
  );

  let teamSubscription: Stripe.Subscription | null = null;

  if (team.subscription) {
    teamSubscription = await stripe.subscriptions.retrieve(team.subscription.planId);

    if (!teamSubscription) {
      throw new Error('Could not find the current subscription.');
    }

    if (clearPaymentMethods) {
      await deleteCustomerPaymentMethods({ customerId: teamCustomerId });
    }
  }

  await stripe.customers.update(teamCustomerId, {
    name: user.name ?? team.name,
    email: user.email,
  });

  // If team subscription is required and the team does not have a subscription, create one.
  if (teamSubscriptionRequired && !teamSubscription) {
    const numberOfSeats = await prisma.teamMember.count({
      where: {
        teamId: team.id,
      },
    });

    const teamSeatPriceId = teamSeatPrices.monthly.priceId;

    teamSubscription = await stripe.subscriptions.create({
      customer: teamCustomerId,
      items: [
        {
          price: teamSeatPriceId,
          quantity: numberOfSeats,
        },
      ],
      metadata: {
        teamId: team.id.toString(),
      },
    });
  }

  // If no team subscription is required, cancel the current team subscription if it exists.
  if (!teamSubscriptionRequired && teamSubscription) {
    try {
      // Set the quantity to 0 so we can refund/charge the old Stripe customer the prorated amount.
      await stripe.subscriptions.update(teamSubscription.id, {
        items: teamSubscription.items.data.map((item) => ({
          id: item.id,
          quantity: 0,
        })),
      });

      await stripe.subscriptions.cancel(teamSubscription.id, {
        invoice_now: true,
        prorate: false,
      });
    } catch (e) {
      // Do not error out since we can't easily undo the transfer.
      // Todo: Teams - Alert us.
    }

    return null;
  }

  return teamSubscription;
};
