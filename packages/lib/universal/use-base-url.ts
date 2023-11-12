import { useRuntimeEnv } from './runtime-env/client';

/* eslint-disable turbo/no-undeclared-env-vars */
export const useBaseUrl = () => {
  const { NEXT_PUBLIC_WEBAPP_URL } = useRuntimeEnv();

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
