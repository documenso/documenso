import { env } from '@documenso/lib/utils/env';

export const APP_DOCUMENT_UPLOAD_SIZE_LIMIT = Number(env('NEXT_PUBLIC_DOCUMENT_SIZE_UPLOAD_LIMIT')) || 50;

export const NEXT_PUBLIC_WEBAPP_URL = () => env('NEXT_PUBLIC_WEBAPP_URL') ?? 'http://localhost:3000';

/**
 * The sub-path the app is served under (no trailing slash), e.g. "/ESign".
 * Returns an empty string when served at root.
 *
 * Prefers the explicit NEXT_PUBLIC_BASE_PATH (which is the same value baked
 * into the Vite/React Router build). Falls back to the pathname of
 * NEXT_PUBLIC_WEBAPP_URL so the function still works in dev when the env
 * variable is unset.
 */
export const getBasePath = (): string => {
  const explicit = env('NEXT_PUBLIC_BASE_PATH');

  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  try {
    return new URL(NEXT_PUBLIC_WEBAPP_URL()).pathname.replace(/\/$/, '');
  } catch {
    return '';
  }
};

export const NEXT_PUBLIC_SIGNING_CONTACT_INFO = () =>
  env('NEXT_PUBLIC_SIGNING_CONTACT_INFO') ?? NEXT_PUBLIC_WEBAPP_URL();

export const NEXT_PRIVATE_USE_LEGACY_SIGNING_SUBFILTER = () =>
  env('NEXT_PRIVATE_USE_LEGACY_SIGNING_SUBFILTER') === 'true';

export const NEXT_PRIVATE_INTERNAL_WEBAPP_URL = () =>
  env('NEXT_PRIVATE_INTERNAL_WEBAPP_URL') ?? NEXT_PUBLIC_WEBAPP_URL();

export const IS_BILLING_ENABLED = () => env('NEXT_PUBLIC_FEATURE_BILLING_ENABLED') === 'true';

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
