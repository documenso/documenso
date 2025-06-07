import { clone } from 'remeda';
import type Stripe from 'stripe';

import { stripe } from '@documenso/lib/server-only/stripe';
import {
  INTERNAL_CLAIM_ID,
  type InternalClaim,
  internalClaims,
} from '@documenso/lib/types/subscription';
import { toHumanPrice } from '@documenso/lib/universal/stripe/to-human-price';

export type InternalClaimPlans = {
  [key in INTERNAL_CLAIM_ID]: InternalClaim & {
    monthlyPrice?: Stripe.Price & {
      product: Stripe.Product;
      isVisibleInApp: boolean;
      friendlyPrice: string;
    };
    yearlyPrice?: Stripe.Price & {
      product: Stripe.Product;
      isVisibleInApp: boolean;
      friendlyPrice: string;
    };
  };
};

/**
 * Returns the main Documenso plans from Stripe.
 */
export const getInternalClaimPlans = async (): Promise<InternalClaimPlans> => {
  const { data: prices } = await stripe.prices.search({
    query: `active:'true' type:'recurring'`,
    expand: ['data.product'],
    limit: 100,
  });

  const plans: InternalClaimPlans = clone(internalClaims);

  prices.forEach((price) => {
    // We use `expand` to get the product, but it's not typed as part of the Price type.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const product = price.product as Stripe.Product;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const productClaimId = product.metadata.claimId as INTERNAL_CLAIM_ID | undefined;
    const isVisibleInApp = price.metadata.visibleInApp === 'true';

    if (!productClaimId || !Object.values(INTERNAL_CLAIM_ID).includes(productClaimId)) {
      return;
    }

    let usdPrice = toHumanPrice(price.unit_amount ?? 0);

    if (price.recurring?.interval === 'month') {
      if (product.metadata['isSeatBased'] === 'true') {
        usdPrice = '50';
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      plans[productClaimId].monthlyPrice = {
        ...price,
        isVisibleInApp,
        product,
        friendlyPrice: `$${usdPrice} ${price.currency.toUpperCase()}`.replace('.00', ''),
      };
    }

    if (price.recurring?.interval === 'year') {
      if (product.metadata['isSeatBased'] === 'true') {
        usdPrice = '480';
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      plans[productClaimId].yearlyPrice = {
        ...price,
        isVisibleInApp,
        product,
        friendlyPrice: `$${usdPrice} ${price.currency.toUpperCase()}`.replace('.00', ''),
      };
    }
  });

  return plans;
};
