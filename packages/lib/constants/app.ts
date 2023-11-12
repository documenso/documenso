import { getRuntimeEnv } from '../universal/runtime-env/get-runtime-env';

export const IS_APP_MARKETING = process.env.NEXT_PUBLIC_PROJECT === 'marketing';
export const IS_APP_WEB = process.env.NEXT_PUBLIC_PROJECT === 'web';

export const APP_FOLDER = IS_APP_MARKETING ? 'marketing' : 'web';

export const APP_BASE_URL = IS_APP_WEB
  ? process.env.NEXT_PUBLIC_WEBAPP_URL
  : process.env.NEXT_PUBLIC_MARKETING_URL;

export const appBaseUrl = () => {
  const { NEXT_PUBLIC_WEBAPP_URL, NEXT_PUBLIC_MARKETING_URL } = getRuntimeEnv();

  if (IS_APP_WEB) {
    return NEXT_PUBLIC_WEBAPP_URL;
  }

  if (IS_APP_MARKETING) {
    return NEXT_PUBLIC_MARKETING_URL;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return NEXT_PUBLIC_WEBAPP_URL ?? 'http://localhost:3000';
};
