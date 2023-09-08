export const IS_APP_MARKETING = process.env.NEXT_PUBLIC_APP === 'marketing';
export const IS_APP_WEB = process.env.NEXT_PUBLIC_APP === 'web';

export const appBaseUrl = IS_APP_WEB
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.NEXT_PUBLIC_MARKETING_SITE_URL;
