import { router } from '../trpc';
import { createSubscriptionRoute } from './create-subscription';
import { getInvoicesRoute } from './get-invoices';
import { getPlansRoute } from './get-plans';
import { getSubscriptionRoute } from './get-subscription';
import { manageSubscriptionRoute } from './manage-subscription';

export const billingRouter = router({
  plans: {
    get: getPlansRoute,
  },
  subscription: {
    get: getSubscriptionRoute,
    create: createSubscriptionRoute,
    manage: manageSubscriptionRoute,
  },
  invoices: {
    get: getInvoicesRoute,
  },
});
