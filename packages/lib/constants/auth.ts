import { IdentityProvider, UserSecurityAuditLogType } from '@documenso/prisma/client';

export const SALT_ROUNDS = 12;

export const IDENTITY_PROVIDER_NAME: { [key in IdentityProvider]: string } = {
  [IdentityProvider.DOCUMENSO]: 'Documenso',
  [IdentityProvider.GOOGLE]: 'Google',
  [IdentityProvider.OIDC]: 'OIDC',
};

export const IS_GOOGLE_SSO_ENABLED = Boolean(
  process.env.NEXT_PRIVATE_GOOGLE_CLIENT_ID && process.env.NEXT_PRIVATE_GOOGLE_CLIENT_SECRET,
);

export const IS_OIDC_SSO_ENABLED = Boolean(
  process.env.NEXT_PRIVATE_OIDC_WELL_KNOWN &&
    process.env.NEXT_PRIVATE_OIDC_CLIENT_ID &&
    process.env.NEXT_PRIVATE_OIDC_CLIENT_SECRET,
);

export const OIDC_PROVIDER_LABEL = process.env.NEXT_PRIVATE_OIDC_PROVIDER_LABEL;

export const USER_SECURITY_AUDIT_LOG_MAP: { [key in UserSecurityAuditLogType]: string } = {
  [UserSecurityAuditLogType.ACCOUNT_SSO_LINK]: 'Linked account to SSO',
  [UserSecurityAuditLogType.ACCOUNT_PROFILE_UPDATE]: 'პროფილი განახლებულია',
  [UserSecurityAuditLogType.AUTH_2FA_DISABLE]: '2FA გამორთულია',
  [UserSecurityAuditLogType.AUTH_2FA_ENABLE]: '2FA ჩართულია',
  [UserSecurityAuditLogType.PASSKEY_CREATED]: 'Passkey created',
  [UserSecurityAuditLogType.PASSKEY_DELETED]: 'Passkey deleted',
  [UserSecurityAuditLogType.PASSKEY_UPDATED]: 'Passkey updated',
  [UserSecurityAuditLogType.PASSWORD_RESET]: 'პაროლის შეცვლა',
  [UserSecurityAuditLogType.PASSWORD_UPDATE]: 'პაროლის განახლება',
  [UserSecurityAuditLogType.SIGN_OUT]: 'Signed Out',
  [UserSecurityAuditLogType.SIGN_IN]: 'ავტორიზებული',
  [UserSecurityAuditLogType.SIGN_IN_FAIL]: 'ავტორიზაცია ვერ მოხერხდა',
  [UserSecurityAuditLogType.SIGN_IN_PASSKEY_FAIL]: 'Passkey sign in failed',
  [UserSecurityAuditLogType.SIGN_IN_2FA_FAIL]: '2FA-ში შესვლა ვერ მოხერხდა',
};

/**
 * The duration to wait for a passkey to be verified in MS.
 */
export const PASSKEY_TIMEOUT = 60000;

/**
 * The maximum number of passkeys are user can have.
 */
export const MAXIMUM_PASSKEYS = 50;
