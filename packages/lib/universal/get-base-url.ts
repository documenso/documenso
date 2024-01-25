/* eslint-disable turbo/no-undeclared-env-vars */
import { env } from 'next-runtime-env';

const NEXT_PUBLIC_WEBAPP_URL = env('NEXT_PUBLIC_WEBAPP_URL');

export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return '';
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (NEXT_PUBLIC_WEBAPP_URL) {
    return NEXT_PUBLIC_WEBAPP_URL;
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};
