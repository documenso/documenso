import { env } from 'next-runtime-env';

export const APP_DOCUMENT_UPLOAD_SIZE_LIMIT =
  Number(process.env.NEXT_PUBLIC_DOCUMENT_SIZE_UPLOAD_LIMIT) || 50;

export const NEXT_PUBLIC_WEBAPP_URL = () => env('NEXT_PUBLIC_WEBAPP_URL');
export const NEXT_PUBLIC_MARKETING_URL = () => env('NEXT_PUBLIC_MARKETING_URL');

export const IS_APP_MARKETING = process.env.NEXT_PUBLIC_PROJECT === 'marketing';
export const IS_APP_WEB = process.env.NEXT_PUBLIC_PROJECT === 'web';
export const IS_BILLING_ENABLED = () => env('NEXT_PUBLIC_FEATURE_BILLING_ENABLED') === 'true';

export const APP_FOLDER = () => (IS_APP_MARKETING ? 'marketing' : 'web');

export const APP_BASE_URL = () =>
  IS_APP_WEB ? NEXT_PUBLIC_WEBAPP_URL() : NEXT_PUBLIC_MARKETING_URL();

export const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL() ?? 'http://localhost:3000';
export const MARKETING_BASE_URL = NEXT_PUBLIC_MARKETING_URL() ?? 'http://localhost:3001';
