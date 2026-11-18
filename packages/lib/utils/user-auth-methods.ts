import { type TUserAuthMethod, UserAuthMethod } from '../types/user-auth-method';

type DeriveUserAuthMethodsOptions = {
  /**
   * Whether the user has a password hash stored.
   */
  hasPassword: boolean;

  /**
   * The number of passkeys registered to the user.
   */
  passkeyCount: number;

  /**
   * The `provider` values of the user's linked `Account` rows.
   */
  accountProviders: string[];
};

const OAUTH_PROVIDER_AUTH_METHODS: Record<string, TUserAuthMethod> = {
  google: UserAuthMethod.GOOGLE,
  microsoft: UserAuthMethod.MICROSOFT,
  oidc: UserAuthMethod.OIDC,
};

/**
 * Derive the distinct set of sign in methods available to a user.
 *
 * Any `Account.provider` value that is not one of the built in OAuth providers
 * is treated as an organisation authentication portal, since those accounts use
 * the organisation ID as the provider.
 */
export const deriveUserAuthMethods = ({
  hasPassword,
  passkeyCount,
  accountProviders,
}: DeriveUserAuthMethodsOptions): TUserAuthMethod[] => {
  const authMethods = new Set<TUserAuthMethod>();

  if (hasPassword) {
    authMethods.add(UserAuthMethod.PASSWORD);
  }

  if (passkeyCount > 0) {
    authMethods.add(UserAuthMethod.PASSKEY);
  }

  for (const provider of accountProviders) {
    authMethods.add(OAUTH_PROVIDER_AUTH_METHODS[provider] ?? UserAuthMethod.ORGANISATION_SSO);
  }

  return Array.from(authMethods);
};
