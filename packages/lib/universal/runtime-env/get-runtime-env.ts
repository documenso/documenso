import { PublicEnv } from './types';

declare global {
  interface Window {
    __unstable_runtimeEnv: PublicEnv;
  }
}

export const getRuntimeEnv = () => {
  if (typeof window === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return Object.entries(process.env)
      .filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}) as PublicEnv;
  }

  if (typeof window !== 'undefined' && window.__unstable_runtimeEnv) {
    return window.__unstable_runtimeEnv;
  }

  throw new Error('RuntimeEnv is not available');
};
