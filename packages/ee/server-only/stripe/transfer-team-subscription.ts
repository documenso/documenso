import type Stripe from 'stripe';

import { stripe } from '@documenso/lib/server-only/stripe';
import {
  getTeamSeatPriceId,
  isSomeSubscriptionsActiveAndCommunityPlan,
} from '@documenso/lib/utils/billing';
import { prisma } from '@documenso/prisma';
import type { Subscription, Team, User } from '@documenso/prisma/client';

import { getStripeCustomerByUser } from './get-customer';

type TransferStripeSubscriptionOptions = {
  user: User & { Subscription: Subscription[] };
  team: Team;
};

/**
 * Transfer the Stripe Team seats subscription from one user to another.
 *
 * Will create a new subscription for the new owner and cancel the old one.
 *
 * Returns the new subscription, null if no subscription is needed (for community plan).
 */
export const transferTeamSubscription = async ({
  user,
  team,
}: TransferStripeSubscriptionOptions) => {
  const teamSeatPriceId = getTeamSeatPriceId();
  const { stripeCustomer } = await getStripeCustomerByUser(user);

  const newOwnerHasCommunityPlan = isSomeSubscriptionsActiveAndCommunityPlan(user.Subscription);
  const currentTeamSubscriptionId = team.subscriptionId;

  let oldSubscription: Stripe.Subscription | null = null;
  let newSubscription: Stripe.Subscription | null = null;

  if (currentTeamSubscriptionId) {
    oldSubscription = await stripe.subscriptions.retrieve(currentTeamSubscriptionId);
  }

  const numberOfSeats = await prisma.teamMember.count({
    where: {
      teamId: team.id,
    },
  });

  if (!newOwnerHasCommunityPlan) {
    let stripeCreateSubscriptionPayload: Stripe.SubscriptionCreateParams = {
      customer: stripeCustomer.id,
      items: [
        {
          price: teamSeatPriceId,
          quantity: numberOfSeats,
        },
      ],
      metadata: {
        teamId: team.id.toString(),
      },
    };

    // If no payment method is attached to the new owner Stripe customer account, send an
    // invoice instead.
    if (!stripeCustomer.invoice_settings.default_payment_method) {
      stripeCreateSubscriptionPayload = {
        ...stripeCreateSubscriptionPayload,
        collection_method: 'send_invoice',
        days_until_due: 7,
      };
    }

    newSubscription = await stripe.subscriptions.create(stripeCreateSubscriptionPayload);
  }

  if (oldSubscription) {
    try {
      // Set the quantity to 0 so we can refund/charge the old Stripe customer the prorated amount.
      await stripe.subscriptions.update(oldSubscription.id, {
        items: oldSubscription.items.data.map((item) => ({
          id: item.id,
          quantity: 0,
        })),
      });

      await stripe.subscriptions.cancel(oldSubscription.id, {
        invoice_now: true,
        prorate: false,
      });
    } catch (e) {
      // Do not error out since we can't easily undo the transfer.
      // Todo: Teams - Alert us.
    }
  }

  return newSubscription;
};
