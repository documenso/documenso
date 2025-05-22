import { getInternalClaimPlans } from '@documenso/ee/server-only/stripe/get-internal-claim-plans';
import { getSubscription } from '@documenso/ee/server-only/stripe/get-subscription';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import { authenticatedProcedure } from '../trpc';
import { ZGetSubscriptionRequestSchema } from './get-subscription.types';

export const getSubscriptionRoute = authenticatedProcedure
  .input(ZGetSubscriptionRequestSchema)
  .query(async ({ ctx, input }) => {
    const { organisationId } = input;

    const userId = ctx.user.id;

    if (!IS_BILLING_ENABLED()) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Billing is not enabled',
      });
    }

    const [subscription, plans] = await Promise.all([
      getSubscription({
        organisationId,
        userId,
      }),
      getInternalClaimPlans(),
    ]);

    return {
      subscription,
      plans,
    };
  });
