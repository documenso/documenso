import { env } from 'next-runtime-env';

const NEXT_PUBLIC_PROJECT = process.env.NEXT_PUBLIC_PROJECT;
const NEXT_PUBLIC_WEBAPP_URL = env('NEXT_PUBLIC_WEBAPP_URL');
const NEXT_PUBLIC_MARKETING_URL = env('NEXT_PUBLIC_MARKETING_URL');

export const IS_APP_MARKETING = NEXT_PUBLIC_PROJECT === 'marketing';
export const IS_APP_WEB = NEXT_PUBLIC_PROJECT === 'web';

export const APP_FOLDER = IS_APP_MARKETING ? 'marketing' : 'web';

export const APP_BASE_URL = IS_APP_WEB ? NEXT_PUBLIC_WEBAPP_URL : NEXT_PUBLIC_MARKETING_URL;
