import { z } from 'zod';

import { env } from '../utils/env';
import { formatPath } from './app';
import {
  IS_GOOGLE_SSO_ENABLED,
  IS_MICROSOFT_SSO_ENABLED,
  IS_OIDC_SSO_ENABLED,
  isSigninDisabledGlobally,
  isSigninEnabledForProvider,
  OIDC_PROVIDER_LABEL,
} from './auth';

export const EMBED_AUTH_POPUP_PATH = '/embed/auth/popup';
export const EMBED_AUTH_COMPLETE_API_PATH = '/api/auth/embed/complete';
export const EMBED_AUTH_COMPLETE_PAGE_PATH = '/embed/auth/complete';

// `account` is the email/password and/or passkey form; the rest are redirect based.
export const ZEmbedPopupAuthProviderSchema = z.enum(['google', 'microsoft', 'oidc', 'csc', 'account']);

export type EmbedPopupAuthProvider = z.infer<typeof ZEmbedPopupAuthProviderSchema>;

// CSC auth is recipient scoped, not user scoped, so the popup needs to know what to authorise.
export const ZEmbedPopupAuthCscOptionsSchema = z.union([
  z.object({
    scope: z.literal('service'),
    token: z.string().min(1),
  }),
  z.object({
    scope: z.literal('credential'),
    token: z.string().min(1),
    sessionId: z.string().min(1),
  }),
]);

export type EmbedPopupAuthCscOptions = z.infer<typeof ZEmbedPopupAuthCscOptionsSchema>;

export const formatEmbedAuthCompleteApiUrl = (state: string) => {
  const searchParams = new URLSearchParams({ state });

  return `${formatPath(EMBED_AUTH_COMPLETE_API_PATH)}?${searchParams.toString()}`;
};

export const ZEmbedAuthCompleteStatusSchema = z.enum(['ok', 'error']);

export type EmbedAuthCompleteStatus = z.infer<typeof ZEmbedAuthCompleteStatusSchema>;

export const formatEmbedAuthCompletePageUrl = (status: EmbedAuthCompleteStatus) => {
  return `${formatPath(EMBED_AUTH_COMPLETE_PAGE_PATH)}?status=${status}`;
};

// The private OAuth credentials are absent from `window.__ENV__`; the client
// only has the derived `NEXT_PUBLIC_*_SSO_ENABLED` booleans from `createPublicEnv()`.
const getSsoAvailability = () => {
  if (typeof window === 'undefined') {
    return {
      google: IS_GOOGLE_SSO_ENABLED,
      microsoft: IS_MICROSOFT_SSO_ENABLED,
      oidc: IS_OIDC_SSO_ENABLED,
      oidcProviderLabel: OIDC_PROVIDER_LABEL,
    };
  }

  return {
    google: env('NEXT_PUBLIC_GOOGLE_SSO_ENABLED') === 'true',
    microsoft: env('NEXT_PUBLIC_MICROSOFT_SSO_ENABLED') === 'true',
    oidc: env('NEXT_PUBLIC_OIDC_SSO_ENABLED') === 'true',
    oidcProviderLabel: env('NEXT_PUBLIC_OIDC_PROVIDER_LABEL'),
  };
};

// Display only; `/start` re-checks server side.
export const getEmbedPopupAuthProviders = () => {
  const sso = getSsoAvailability();

  return {
    google: sso.google && isSigninEnabledForProvider('google'),
    microsoft: sso.microsoft && isSigninEnabledForProvider('microsoft'),
    oidc: sso.oidc && isSigninEnabledForProvider('oidc'),
    oidcProviderLabel: sso.oidcProviderLabel || undefined,
    // Passkeys stay available when email/password is disabled, matching `/signin`.
    account: !isSigninDisabledGlobally(),
  };
};

export const EMBED_AUTH_POPUP_WINDOW_NAME = 'documenso-embed-auth';

export const EMBED_AUTH_POPUP_WINDOW_FEATURES = 'popup,width=500,height=680';

export const EMBED_AUTH_MESSAGE_READY = 'documenso-embed-auth:ready';
export const EMBED_AUTH_MESSAGE_NONCE = 'documenso-embed-auth:nonce';

// `complete` and `failed` are accelerators only; the iframe learns the outcome
// via redeem polling if the opener link was severed.
export const EMBED_AUTH_MESSAGE_COMPLETE = 'documenso-embed-auth:complete';
export const EMBED_AUTH_MESSAGE_FAILED = 'documenso-embed-auth:failed';

export const ZEmbedAuthReadyMessageSchema = z.object({
  type: z.literal(EMBED_AUTH_MESSAGE_READY),
});

export const ZEmbedAuthNonceMessageSchema = z.object({
  type: z.literal(EMBED_AUTH_MESSAGE_NONCE),
  nonce: z.string().uuid(),
});

export const ZEmbedAuthCompleteMessageSchema = z.object({
  type: z.literal(EMBED_AUTH_MESSAGE_COMPLETE),
});

export const ZEmbedAuthFailedMessageSchema = z.object({
  type: z.literal(EMBED_AUTH_MESSAGE_FAILED),
});
