/* eslint-disable turbo/no-undeclared-env-vars */
export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return '';
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NEXT_PUBLIC_WEBAPP_URL) {
    return process.env.NEXT_PUBLIC_WEBAPP_URL;
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};
