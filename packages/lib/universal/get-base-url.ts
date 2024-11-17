/* eslint-disable turbo/no-undeclared-env-vars */
import { NEXT_PUBLIC_MARKETING_URL } from '../constants/app';

export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return '';
  }

  const marketingAppUrl = NEXT_PUBLIC_MARKETING_URL();

  if (marketingAppUrl) {
    return marketingAppUrl;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};
