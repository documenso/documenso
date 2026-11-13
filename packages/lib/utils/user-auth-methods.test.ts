import { describe, expect, it } from 'vitest';

import { UserAuthMethod } from '../types/user-auth-method';
import { deriveUserAuthMethods } from './user-auth-methods';

describe('deriveUserAuthMethods', () => {
  it('returns an empty list when the user has no sign in methods', () => {
    expect(deriveUserAuthMethods({ hasPassword: false, passkeyCount: 0, accountProviders: [] })).toEqual([]);
  });

  it('includes PASSWORD when the user has a password', () => {
    expect(deriveUserAuthMethods({ hasPassword: true, passkeyCount: 0, accountProviders: [] })).toEqual([
      UserAuthMethod.PASSWORD,
    ]);
  });

  it('includes PASSKEY when the user has at least one passkey', () => {
    expect(deriveUserAuthMethods({ hasPassword: false, passkeyCount: 2, accountProviders: [] })).toEqual([
      UserAuthMethod.PASSKEY,
    ]);
  });

  it('maps built in OAuth providers to their auth method', () => {
    expect(
      deriveUserAuthMethods({
        hasPassword: false,
        passkeyCount: 0,
        accountProviders: ['google', 'microsoft', 'oidc'],
      }),
    ).toEqual([UserAuthMethod.GOOGLE, UserAuthMethod.MICROSOFT, UserAuthMethod.OIDC]);
  });

  it('treats unknown providers as organisation SSO', () => {
    expect(
      deriveUserAuthMethods({
        hasPassword: false,
        passkeyCount: 0,
        accountProviders: ['org_abc123'],
      }),
    ).toEqual([UserAuthMethod.ORGANISATION_SSO]);
  });

  it('deduplicates repeated providers', () => {
    expect(
      deriveUserAuthMethods({
        hasPassword: true,
        passkeyCount: 0,
        accountProviders: ['google', 'google', 'org_a', 'org_b'],
      }),
    ).toEqual([UserAuthMethod.PASSWORD, UserAuthMethod.GOOGLE, UserAuthMethod.ORGANISATION_SSO]);
  });
});
