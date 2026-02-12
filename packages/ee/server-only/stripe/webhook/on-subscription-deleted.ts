import { SubscriptionStatus } from '@prisma/client';

import { createOrganisationClaimUpsertData } from '@documenso/lib/server-only/organisation/create-organisation';
import type { Stripe } from '@documenso/lib/server-only/stripe';
import { INTERNAL_CLAIM_ID, internalClaims } from '@documenso/lib/types/subscription';
import { prisma } from '@documenso/prisma';

import { extractStripeClaimId } from './on-subscription-updated';

export type OnSubscriptionDeletedOptions = {
  subscription: Stripe.Subscription;
};

export const onSubscriptionDeleted = async ({ subscription }: OnSubscriptionDeletedOptions) => {
  const existingSubscription = await prisma.subscription.findUnique({
    where: {
      planId: subscription.id,
    },
    include: {
      organisation: {
        include: {
          organisationClaim: true,
        },
      },
    },
  });

  // If the subscription doesn't exist, we don't need to do anything.
  if (!existingSubscription) {
    return;
  }

  const subscriptionClaimId = await extractClaimIdFromStripeSubscription(subscription);

  // Individuals get their subscription deleted so they can return to the
  // free plan.
  if (subscriptionClaimId === INTERNAL_CLAIM_ID.INDIVIDUAL) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.delete({
        where: {
          id: existingSubscription.id,
        },
      });

      await tx.organisationClaim.update({
        where: {
          id: existingSubscription.organisation.organisationClaim.id,
        },
        data: {
          originalSubscriptionClaimId: INTERNAL_CLAIM_ID.FREE,
          ...createOrganisationClaimUpsertData(internalClaims[INTERNAL_CLAIM_ID.FREE]),
        },
      });
    });

    return;
  }

  // For all other cases, mark the subscription as inactive since
  // they should still have a "Personal" account.
  await prisma.subscription.update({
    where: {
      id: existingSubscription.id,
    },
    data: {
      status: SubscriptionStatus.INACTIVE,
    },
  });
};

/**
 * Extracts the claim ID from the Stripe subscription.
 *
 * Returns `null` if no claim ID found.
 */
const extractClaimIdFromStripeSubscription = async (subscription: Stripe.Subscription) => {
  const deletedItem = subscription.items.data[0];

  if (!deletedItem) {
    return null;
  }

  try {
    return await extractStripeClaimId(deletedItem.price);
  } catch (error) {
    console.error(error);
    return null;
  }
};
