import { onSubscriptionUpdated } from '@documenso/ee/server-only/stripe/webhook/on-subscription-updated';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { Stripe, stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZSyncOrganisationSubscriptionRequestSchema,
  ZSyncOrganisationSubscriptionResponseSchema,
} from './sync-organisation-subscription.types';

export const syncOrganisationSubscriptionRoute = adminProcedure
  .input(ZSyncOrganisationSubscriptionRequestSchema)
  .output(ZSyncOrganisationSubscriptionResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, syncClaims } = input;

    ctx.logger.info({
      input: {
        organisationId,
        syncClaims,
      },
    });

    const organisation = await prisma.organisation.findUnique({
      where: { id: organisationId },
      include: {
        subscription: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    if (!organisation.subscription) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Organisation has no subscription to sync',
      });
    }

    let stripeSubscription: Stripe.Subscription;

    try {
      stripeSubscription = await stripe.subscriptions.retrieve(organisation.subscription.planId, {
        expand: ['items.data.price.product'],
      });
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === 'resource_missing') {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Subscription not found on Stripe',
        });
      }

      throw error;
    }

    const stripeCustomerId =
      typeof stripeSubscription.customer === 'string' ? stripeSubscription.customer : stripeSubscription.customer.id;

    if (organisation.customerId !== stripeCustomerId) {
      ctx.logger.error({
        message: 'Organisation customerId does not match Stripe subscription customer',
        organisationId,
        localCustomerId: organisation.customerId,
        stripeCustomerId,
      });

      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Organisation customerId mismatch: local=${organisation.customerId ?? 'null'}, Stripe=${stripeCustomerId}`,
      });
    }

    await onSubscriptionUpdated({
      subscription: stripeSubscription,
      previousAttributes: null,
      bypassClaimUpdate: !syncClaims,
    });
  });
