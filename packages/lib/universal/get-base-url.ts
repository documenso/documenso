/* eslint-disable turbo/no-undeclared-env-vars */
<<<<<<< HEAD
=======
import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';

>>>>>>> main
export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return '';
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

<<<<<<< HEAD
  if (process.env.NEXT_PUBLIC_WEBAPP_URL) {
    return process.env.NEXT_PUBLIC_WEBAPP_URL;
=======
  const webAppUrl = NEXT_PUBLIC_WEBAPP_URL();

  if (webAppUrl) {
    return webAppUrl;
>>>>>>> main
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};
