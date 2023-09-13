export const IS_APP_MARKETING = process.env.NEXT_PUBLIC_APP === 'marketing';
export const IS_APP_WEB = process.env.NEXT_PUBLIC_APP === 'web';

export const APP_FOLDER = IS_APP_MARKETING ? 'marketing' : 'web';

export const APP_BASE_URL = IS_APP_WEB
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.NEXT_PUBLIC_MARKETING_SITE_URL;
