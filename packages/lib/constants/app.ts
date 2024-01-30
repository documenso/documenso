export const IS_APP_MARKETING = process.env.NEXT_PUBLIC_PROJECT === 'marketing';
export const IS_APP_WEB = process.env.NEXT_PUBLIC_PROJECT === 'web';

export const APP_FOLDER = IS_APP_MARKETING ? 'marketing' : 'web';

export const APP_BASE_URL = IS_APP_WEB
  ? process.env.NEXT_PUBLIC_WEBAPP_URL
  : process.env.NEXT_PUBLIC_MARKETING_URL;

export const APP_DOCUMENT_UPLOAD_SIZE_LIMIT =
  Number(process.env.NEXT_PUBLIC_DOCUMENT_SIZE_UPLOAD_LIMIT) ?? 50;