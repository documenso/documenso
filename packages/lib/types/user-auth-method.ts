import { z } from 'zod';

/**
 * The methods a user can use to sign in to their account.
 */
export const UserAuthMethod = {
  PASSWORD: 'PASSWORD',
  PASSKEY: 'PASSKEY',
  GOOGLE: 'GOOGLE',
  MICROSOFT: 'MICROSOFT',
  OIDC: 'OIDC',
  ORGANISATION_SSO: 'ORGANISATION_SSO',
} as const;

export const ZUserAuthMethodSchema = z.nativeEnum(UserAuthMethod);

export type TUserAuthMethod = z.infer<typeof ZUserAuthMethodSchema>;
