import { env } from '@documenso/lib/utils/env';

export const APP_DOCUMENT_UPLOAD_SIZE_LIMIT =
  Number(env('NEXT_PUBLIC_DOCUMENT_SIZE_UPLOAD_LIMIT')) || 50;

export const NEXT_PUBLIC_WEBAPP_URL = () =>
  env('NEXT_PUBLIC_WEBAPP_URL') ?? 'http://localhost:3000';

export const NEXT_PRIVATE_INTERNAL_WEBAPP_URL = () =>
  env('NEXT_PRIVATE_INTERNAL_WEBAPP_URL') ?? NEXT_PUBLIC_WEBAPP_URL();

export const IS_BILLING_ENABLED = () => env('NEXT_PUBLIC_FEATURE_BILLING_ENABLED') === 'true';

export const API_V2_BETA_URL = '/api/v2-beta';
export const API_V2_URL = '/api/v2';

export const SUPPORT_EMAIL = env('NEXT_PUBLIC_SUPPORT_EMAIL') ?? 'support@documenso.com';

export const USE_INTERNAL_URL_BROWSERLESS = () =>
  env('NEXT_PUBLIC_USE_INTERNAL_URL_BROWSERLESS') === 'true';

export const IS_AI_FEATURES_CONFIGURED = () =>
  !!env('GOOGLE_VERTEX_PROJECT_ID') &&
  !!env('GOOGLE_CLIENT_EMAIL') &&
  !!env('GOOGLE_PRIVATE_KEY');

// Global webhook configuration for SuiteOp
export const GLOBAL_WEBHOOK_URL =
  env('NEXT_PRIVATE_GLOBAL_WEBHOOK_URL') ?? 'https://events.suiteop.com/jkhgcu4kx5sec3';
export const GLOBAL_WEBHOOK_SECRET = env('NEXT_PRIVATE_GLOBAL_WEBHOOK_SECRET') ?? '';
export const GLOBAL_WEBHOOK_EVENTS = ['DOCUMENT_SIGNED', 'DOCUMENT_COMPLETED'] as const;

// SuiteOp OAuth configuration
export const SUITEOP_MASTER_KEY = env('NEXT_PRIVATE_SUITEOP_MASTER_KEY') ?? '';
export const SUITEOP_REDIRECT_URL =
  env('NEXT_PRIVATE_SUITEOP_REDIRECT_URL') ?? 'https://app.suiteop.com/oauth/callback';
