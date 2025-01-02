// Todo: Reimport

export const SALT_ROUNDS = 12;

export const IDENTITY_PROVIDER_NAME: Record<string, string> = {
  DOCUMENSO: 'Documenso',
  GOOGLE: 'Google',
  OIDC: 'OIDC',
};

export const IS_GOOGLE_SSO_ENABLED = Boolean(
  import.meta.env.NEXT_PRIVATE_GOOGLE_CLIENT_ID &&
    import.meta.env.NEXT_PRIVATE_GOOGLE_CLIENT_SECRET,
);

export const IS_OIDC_SSO_ENABLED = Boolean(
  process.env.NEXT_PRIVATE_OIDC_WELL_KNOWN &&
    process.env.NEXT_PRIVATE_OIDC_CLIENT_ID &&
    process.env.NEXT_PRIVATE_OIDC_CLIENT_SECRET,
);

export const OIDC_PROVIDER_LABEL = process.env.NEXT_PRIVATE_OIDC_PROVIDER_LABEL;

export const USER_SECURITY_AUDIT_LOG_MAP: Record<string, string> = {
  ACCOUNT_SSO_LINK: 'Linked account to SSO',
  ACCOUNT_PROFILE_UPDATE: 'Profile updated',
  AUTH_2FA_DISABLE: '2FA Disabled',
  AUTH_2FA_ENABLE: '2FA Enabled',
  PASSKEY_CREATED: 'Passkey created',
  PASSKEY_DELETED: 'Passkey deleted',
  PASSKEY_UPDATED: 'Passkey updated',
  PASSWORD_RESET: 'Password reset',
  PASSWORD_UPDATE: 'Password updated',
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
  process.env.NODE_ENV === 'production' && String(process.env.NEXTAUTH_URL).startsWith('https://');

const secureCookiePrefix = useSecureCookies ? '__Secure-' : '';

export const formatSecureCookieName = (name: string) => `${secureCookiePrefix}${name}`;
