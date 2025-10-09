import { env } from '../utils/env';
import { NEXT_PUBLIC_WEBAPP_URL } from './app';

export const SALT_ROUNDS = 12;

export const IDENTITY_PROVIDER_NAME: Record<string, string> = {
  DOCUMENSO: 'Documenso',
  GOOGLE: 'Google',
  MICROSOFT: 'Microsoft',
  OIDC: 'OIDC',
};

export const IS_GOOGLE_SSO_ENABLED = Boolean(
  env('NEXT_PRIVATE_GOOGLE_CLIENT_ID') && env('NEXT_PRIVATE_GOOGLE_CLIENT_SECRET'),
);

export const IS_MICROSOFT_SSO_ENABLED = Boolean(
  env('NEXT_PRIVATE_MICROSOFT_CLIENT_ID') && env('NEXT_PRIVATE_MICROSOFT_CLIENT_SECRET'),
);

export const IS_OIDC_SSO_ENABLED = Boolean(
  env('NEXT_PRIVATE_OIDC_WELL_KNOWN') &&
    env('NEXT_PRIVATE_OIDC_CLIENT_ID') &&
    env('NEXT_PRIVATE_OIDC_CLIENT_SECRET'),
);

export const OIDC_PROVIDER_LABEL = env('NEXT_PRIVATE_OIDC_PROVIDER_LABEL');

export const USER_SECURITY_AUDIT_LOG_MAP: Record<string, string> = {
  ACCOUNT_SSO_LINK: 'Linked account to SSO',
  ACCOUNT_SSO_UNLINK: 'Unlinked account from SSO',
  ORGANISATION_SSO_LINK: 'Linked account to organisation',
  ORGANISATION_SSO_UNLINK: 'Unlinked account from organisation',
  ACCOUNT_PROFILE_UPDATE: 'Profile updated',
  AUTH_2FA_DISABLE: '2FA Disabled',
  AUTH_2FA_ENABLE: '2FA Enabled',
  PASSKEY_CREATED: 'Passkey created',
  PASSKEY_DELETED: 'Passkey deleted',
  PASSKEY_UPDATED: 'Passkey updated',
  PASSWORD_RESET: 'Password reset',
  PASSWORD_UPDATE: 'Password updated',
  SESSION_REVOKED: 'Session revoked',
  SIGN_OUT: 'Signed Out',
  SIGN_IN: 'Signed In',
  SIGN_IN_FAIL: 'Sign in attempt failed',
  SIGN_IN_PASSKEY_FAIL: 'Passkey sign in failed',
  SIGN_IN_2FA_FAIL: 'Sign in 2FA attempt failed',
};

/**
 * The duration to wait for a passkey to be verified in MS.
 */
export const PASSKEY_TIMEOUT = 60000;

/**
 * The maximum number of passkeys are user can have.
 */
export const MAXIMUM_PASSKEYS = 50;

export const useSecureCookies =
  env('NODE_ENV') === 'production' && String(NEXT_PUBLIC_WEBAPP_URL()).startsWith('https://');

const secureCookiePrefix = useSecureCookies ? '__Secure-' : '';

export const formatSecureCookieName = (name: string) => `${secureCookiePrefix}${name}`;

export const getCookieDomain = () => {
  const url = new URL(NEXT_PUBLIC_WEBAPP_URL());

  return url.hostname;
};
