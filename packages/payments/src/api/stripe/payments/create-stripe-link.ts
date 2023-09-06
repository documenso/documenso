/* eslint-disable no-async-promise-executor */

/* eslint-disable @typescript-eslint/promise-function-async */

/* eslint-disable @typescript-eslint/no-misused-promises */
import { stripeProvider } from '../../../providers';

/**
 * Generate stripe payment link
 * @param priceId `id` of the `price` object return by stripe
 * @param qty quantity of `product` to charge for
 * @returns Promise which resolves into stripes `payment` object
 */
export const createStripeLink = (priceId: string, qty: number) => {
  return new Promise(async (resolve, reject) => {
    try {
      const link = await stripeProvider.paymentLinks.create({
        line_items: [{ price: priceId, quantity: qty }],
      });

      resolve(link);
    } catch (error) {
      reject(error);
    }
  });
};
