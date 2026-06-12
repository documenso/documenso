import { syncStripeCustomerSubscription } from '@documenso/ee/server-only/stripe/sync-stripe-customer-subscription';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
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
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    if (!organisation.customerId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Organisation has no Stripe customer to sync from',
      });
    }

    await syncStripeCustomerSubscription({
      customerId: organisation.customerId,
      bypassClaimUpdate: !syncClaims,
    });
  });
