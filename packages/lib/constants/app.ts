import { env } from '@documenso/lib/utils/env';

export const APP_DOCUMENT_UPLOAD_SIZE_LIMIT = Number(env('NEXT_PUBLIC_DOCUMENT_SIZE_UPLOAD_LIMIT')) || 50;

export const NEXT_PUBLIC_WEBAPP_URL = () => env('NEXT_PUBLIC_WEBAPP_URL') ?? 'http://localhost:3000';

export const NEXT_PUBLIC_SIGNING_CONTACT_INFO = () =>
  env('NEXT_PUBLIC_SIGNING_CONTACT_INFO') ?? NEXT_PUBLIC_WEBAPP_URL();

export const NEXT_PRIVATE_USE_LEGACY_SIGNING_SUBFILTER = () =>
  env('NEXT_PRIVATE_USE_LEGACY_SIGNING_SUBFILTER') === 'true';

export const NEXT_PRIVATE_INTERNAL_WEBAPP_URL = () =>
  env('NEXT_PRIVATE_INTERNAL_WEBAPP_URL') ?? NEXT_PUBLIC_WEBAPP_URL();

export const IS_BILLING_ENABLED = () => env('NEXT_PUBLIC_FEATURE_BILLING_ENABLED') === 'true';

/**
 * Team analytics dashboard rollout flag.
 *
 * Acts as a kill-switch: enabled by default and disabled only when the env var
 * is explicitly set to "false". This keeps the feature available to all teams
 * while leaving a single lever to gate it off during rollout.
 */
export const IS_TEAM_ANALYTICS_ENABLED = () => env('NEXT_PUBLIC_FEATURE_TEAM_ANALYTICS_ENABLED') !== 'false';

export const API_V2_BETA_URL = '/api/v2-beta';
export const API_V2_URL = '/api/v2';

export const SUPPORT_EMAIL = env('NEXT_PUBLIC_SUPPORT_EMAIL') ?? 'support@documenso.com';

export const USE_INTERNAL_URL_BROWSERLESS = () => env('NEXT_PUBLIC_USE_INTERNAL_URL_BROWSERLESS') === 'true';

export const IS_AI_FEATURES_CONFIGURED = () => !!env('GOOGLE_VERTEX_PROJECT_ID') && !!env('GOOGLE_VERTEX_API_KEY');

/**
 * Temporary flag to toggle between Playwright-based and Konva-based PDF generation
 * for audit logs during sealing.
 *
 * @deprecated This is a temporary flag and will be removed once Konva-based generation is stable.
 */
export const NEXT_PRIVATE_USE_PLAYWRIGHT_PDF = () => env('NEXT_PRIVATE_USE_PLAYWRIGHT_PDF') === 'true';

export const NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY = () => env('NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY');
