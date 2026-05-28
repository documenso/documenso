import MailChecker from 'mailchecker';
import { z } from 'zod';

import { env } from '../utils/env';
import { NEXT_PUBLIC_WEBAPP_URL } from './app';

export const SALT_ROUNDS = 12;

export const URL_PATTERN = /https?:\/\/|www\./i;

/**
 * Shared name schema that disallows URLs to prevent phishing via email rendering.
 */
export const ZNameSchema = z
  .string()
  .trim()
  .min(3, { message: 'Please enter a valid name.' })
  .max(255, { message: 'Name cannot be more than 255 characters.' })
  .refine((value) => !URL_PATTERN.test(value), {
    message: 'Name cannot contain URLs.',
  });

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
  env('NEXT_PRIVATE_OIDC_WELL_KNOWN') && env('NEXT_PRIVATE_OIDC_CLIENT_ID') && env('NEXT_PRIVATE_OIDC_CLIENT_SECRET'),
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

/**
 * Get allowed signup domains from env var.
 * Returns empty array if not set (meaning all domains allowed).
 */
export const getAllowedSignupDomains = (): string[] => {
  const domains = env('NEXT_PRIVATE_ALLOWED_SIGNUP_DOMAINS');

  if (!domains) {
    return [];
  }

  return domains
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
};

/**
 * Check if email domain is allowed for signup.
 * Returns true if no domain restriction is configured.
 */
export const isEmailDomainAllowedForSignup = (email: string): boolean => {
  const allowedDomains = getAllowedSignupDomains();

  if (allowedDomains.length === 0) {
    return true;
  }

  const emailDomain = email.toLowerCase().split('@').pop();

  if (!emailDomain) {
    return false;
  }

  return allowedDomains.includes(emailDomain);
};

/**
 * Check if the given email belongs to a known disposable / throwaway provider
 * (e.g. mailinator, yopmail, 10minutemail, ...).
 *
 * Backed by the `mailchecker` package which bundles a static list of 55k+
 * disposable domains. The check is offline and synchronous.
 *
 * Matching also covers subdomains (e.g. `foo.mailinator.com` resolves to
 * `mailinator.com`).
 *
 * An optional `additionalBlockedDomains` list can be supplied to layer
 * admin-configured custom domains on top of the bundled list. These are
 * matched with the same subdomain-walking behaviour and are expected to be
 * pre-normalised (trimmed + lowercased) by the caller.
 *
 * Returns `true` when the email is disposable and should be rejected.
 * Email format validation is intentionally NOT performed here — that is
 * handled by Zod upstream.
 */
export const isDisposableEmail = (email: string, additionalBlockedDomains: string[] = []): boolean => {
  const domain = email.toLowerCase().split('@').pop();

  if (!domain) {
    return false;
  }

  const blacklist = MailChecker.blacklist();
  const blocklist = new Set(additionalBlockedDomains);

  let currentDomain: string | undefined = domain;

  while (currentDomain) {
    if (blacklist.has(currentDomain) || blocklist.has(currentDomain)) {
      return true;
    }

    const nextDot = currentDomain.indexOf('.');

    if (nextDot === -1) {
      break;
    }

    currentDomain = currentDomain.slice(nextDot + 1);
  }

  return false;
};

/**
 * Check if signup is enabled for the given provider.
 * The master switch takes precedence over the per-provider flags.
 */
export const isSignupEnabledForProvider = (provider: 'email' | 'google' | 'microsoft' | 'oidc'): boolean => {
  if (env('NEXT_PUBLIC_DISABLE_SIGNUP') === 'true') {
    return false;
  }

  const flagMap = {
    email: 'NEXT_PUBLIC_DISABLE_EMAIL_PASSWORD_SIGNUP',
    google: 'NEXT_PUBLIC_DISABLE_GOOGLE_SIGNUP',
    microsoft: 'NEXT_PUBLIC_DISABLE_MICROSOFT_SIGNUP',
    oidc: 'NEXT_PUBLIC_DISABLE_OIDC_SIGNUP',
  } as const;

  return env(flagMap[provider]) !== 'true';
};
