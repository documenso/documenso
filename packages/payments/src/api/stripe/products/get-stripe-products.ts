/* eslint-disable no-async-promise-executor */

/* eslint-disable @typescript-eslint/promise-function-async */

/* eslint-disable @typescript-eslint/no-misused-promises */
import { stripeProvider } from '../../../providers';

export interface stripeProduct {
  id: string;
  name: string;
}

/**
 * Retrieve all `product` objects from stripe
 * @returns Promise which resolves into array of stripe's `product` objects
 */
export const getStripeProduct = (): Promise<stripeProduct[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await stripeProvider.products.list();

      const products = response.data;

      resolve(products);
    } catch (error) {
      reject(error);
    }
  });
};
