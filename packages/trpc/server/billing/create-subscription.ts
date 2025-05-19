import { createCheckoutSession } from '@documenso/ee/server-only/stripe/create-checkout-session';
import { createCustomer } from '@documenso/ee/server-only/stripe/create-customer';
import { IS_BILLING_ENABLED, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZCreateSubscriptionRequestSchema } from './create-subscription.types';

export const createSubscriptionRoute = authenticatedProcedure
  .input(ZCreateSubscriptionRequestSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, priceId } = input;

    const userId = ctx.user.id;

    if (!IS_BILLING_ENABLED()) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Billing is not enabled',
      });
    }

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery(
        organisationId,
        userId,
        ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_BILLING'],
      ),
      include: {
        subscription: true,
        owner: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    let customerId = organisation.customerId;

    if (!customerId) {
      const customer = await createCustomer({
        name: organisation.name,
        email: organisation.owner.email,
      });

      customerId = customer.id;

      await prisma.organisation.update({
        where: {
          id: organisationId,
        },
        data: {
          customerId: customer.id,
        },
      });
    }

    const redirectUrl = await createCheckoutSession({
      customerId,
      priceId,
      returnUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/org/${organisation.url}/settings/billing`,
    });

    if (!redirectUrl) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to create checkout session',
      });
    }

    return {
      redirectUrl,
    };
  });
