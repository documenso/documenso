import { IdentityProvider, UserSecurityAuditLogType } from '@documenso/prisma/client';

export const SALT_ROUNDS = 12;

export const IDENTITY_PROVIDER_NAME: { [key in IdentityProvider]: string } = {
  [IdentityProvider.DOCUMENSO]: 'Documenso',
  [IdentityProvider.GOOGLE]: 'Google',
};

export const IS_GOOGLE_SSO_ENABLED = Boolean(
  process.env.NEXT_PRIVATE_GOOGLE_CLIENT_ID && process.env.NEXT_PRIVATE_GOOGLE_CLIENT_SECRET,
);

export const USER_SECURITY_AUDIT_LOG_MAP: { [key in UserSecurityAuditLogType]: string } = {
  [UserSecurityAuditLogType.ACCOUNT_SSO_LINK]: 'Linked account to SSO',
  [UserSecurityAuditLogType.ACCOUNT_PROFILE_UPDATE]: 'Profile updated',
  [UserSecurityAuditLogType.AUTH_2FA_DISABLE]: '2FA Disabled',
  [UserSecurityAuditLogType.AUTH_2FA_ENABLE]: '2FA Enabled',
  [UserSecurityAuditLogType.PASSWORD_RESET]: 'Password reset',
  [UserSecurityAuditLogType.PASSWORD_UPDATE]: 'Password updated',
  [UserSecurityAuditLogType.SIGN_OUT]: 'Signed Out',
  [UserSecurityAuditLogType.SIGN_IN]: 'Signed In',
  [UserSecurityAuditLogType.SIGN_IN_FAIL]: 'Sign in attempt failed',
  [UserSecurityAuditLogType.SIGN_IN_2FA_FAIL]: 'Sign in 2FA attempt failed',
};
