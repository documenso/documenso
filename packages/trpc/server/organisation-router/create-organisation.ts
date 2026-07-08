import { createCheckoutSession } from '@documenso/ee/server-only/stripe/create-checkout-session';
import { createCustomer } from '@documenso/ee/server-only/stripe/create-customer';
import { IS_BILLING_ENABLED, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { getSubscriptionClaim } from '@documenso/lib/server-only/subscription/get-subscription-claim';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { prisma } from '@documenso/prisma';
import { OrganisationType, SubscriptionStatus } from '@prisma/client';
import { authenticatedProcedure } from '../trpc';
import { ZCreateOrganisationRequestSchema, ZCreateOrganisationResponseSchema } from './create-organisation.types';

export const createOrganisationRoute = authenticatedProcedure
  // .meta(createOrganisationMeta)
  .input(ZCreateOrganisationRequestSchema)
  .output(ZCreateOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { name, priceId } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        priceId,
      },
    });

    // Check if user can create a free organiastion.
    if (IS_BILLING_ENABLED() && !priceId) {
      const userOrganisations = await prisma.organisation.findMany({
        where: {
          ownerUserId: user.id,
          subscription: {
            is: null,
          },
        },
      });

      if (userOrganisations.length >= 1) {
        throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
          message: 'You have reached the maximum number of free organisations.',
        });
      }
    }

    // Create the organisation upfront, then redirect to checkout for payment.
    // The webhook sync will attach the real subscription and claim after payment.
    if (IS_BILLING_ENABLED() && priceId) {
      const pendingOrganisation = await prisma.organisation.findFirst({
        where: {
          ownerUserId: user.id,
          type: OrganisationType.ORGANISATION,
          OR: [
            {
              subscription: {
                is: null,
              },
            },
            {
              subscription: {
                status: SubscriptionStatus.INACTIVE,
              },
            },
          ],
        },
      });

      if (pendingOrganisation) {
        throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
          message: 'You have a pending organisation awaiting payment. Complete or remove it before creating a new one.',
        });
      }

      const freeSubscriptionClaim = await getSubscriptionClaim(INTERNAL_CLAIM_ID.FREE);

      const organisation = await createOrganisation({
        userId: user.id,
        name,
        type: OrganisationType.ORGANISATION,
        claim: freeSubscriptionClaim,
      });

      let customerId = organisation.customerId;

      if (!customerId) {
        const customer = await createCustomer({
          email: user.email,
          name: user.name || user.email,
        });

        customerId = customer.id;

        await prisma.organisation.update({
          where: {
            id: organisation.id,
          },
          data: {
            customerId,
          },
        });
      }

      const checkoutUrl = await createCheckoutSession({
        priceId,
        customerId,
        returnUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/o/${organisation.url}/settings/billing`,
      });

      return {
        paymentRequired: true,
        checkoutUrl,
      };
    }

    // Free organisations should be Personal by default.
    const organisationType = IS_BILLING_ENABLED() ? OrganisationType.PERSONAL : OrganisationType.ORGANISATION;

    const freeSubscriptionClaim = await getSubscriptionClaim(INTERNAL_CLAIM_ID.FREE);

    await createOrganisation({
      userId: user.id,
      name,
      type: organisationType,
      claim: freeSubscriptionClaim,
    });

    return {
      paymentRequired: false,
    };
  });
