/**
 * Stub implementation for getting prices by interval.
 * In the stub version, returns empty lists for all price intervals.
 */

export type PriceIntervals = 'yearly' | 'monthly';

export const getPricesByInterval = async ({ plans }: { plans?: string[] } = {}) => {
  return {
    yearly: [],
    monthly: [],
  };
};
