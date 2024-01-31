/* eslint-disable turbo/no-undeclared-env-vars */
import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';

export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return '';
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const webAppUrl = NEXT_PUBLIC_WEBAPP_URL();

  if (webAppUrl) {
    return webAppUrl;
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};
