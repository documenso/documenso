/* eslint-disable no-async-promise-executor */

/* eslint-disable @typescript-eslint/promise-function-async */

/* eslint-disable @typescript-eslint/no-misused-promises */
import { stripeProvider } from '../../../providers';

/**
 * Retieves all `prices` object from stripe
 * @param productId `id` of the stripe `product` object
 * @returns Promise which resolves into array of stripe's `price` object
 */
export const getStripePrices = async (productId: string) => {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await stripeProvider.prices.list();

      const prices = response.data.filter((item) => item.product === productId);

      resolve(prices);
    } catch (error) {
      reject(error);
    }
  });
};
