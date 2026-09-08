import { createRateLimit } from './rate-limit';

// ---- Auth (Tier 1 - Critical, sends emails) ----

export const signupRateLimit = createRateLimit({
  action: 'auth.signup',
  max: 3,
  window: '3h',
});

export const forgotPasswordRateLimit = createRateLimit({
  action: 'auth.forgot-password',
  max: 3,
  globalMax: 20,
  window: '1h',
});

export const resendVerifyEmailRateLimit = createRateLimit({
  action: 'auth.resend-verify-email',
  max: 3,
  globalMax: 20,
  window: '1h',
});

export const request2FAEmailRateLimit = createRateLimit({
  action: 'auth.request-2fa-email',
  max: 5,
  globalMax: 20,
  window: '15m',
});

// ---- Auth (Tier 2 - Unauthenticated) ----

export const loginRateLimit = createRateLimit({
  action: 'auth.login',
  max: 10,
  globalMax: 50,
  window: '15m',
});

export const resetPasswordRateLimit = createRateLimit({
  action: 'auth.reset-password',
  max: 5,
  globalMax: 20,
  window: '1h',
});

export const verifyEmailRateLimit = createRateLimit({
  action: 'auth.verify-email',
  max: 5,
  globalMax: 20,
  window: '15m',
});

export const passkeyRateLimit = createRateLimit({
  action: 'auth.passkey',
  max: 10,
  globalMax: 50,
  window: '15m',
});

/**
 * IP-scoped limit for the unauthenticated 2FA challenge endpoint, checked
 * BEFORE the challenge cookie is resolved so hammering without a valid cookie
 * is bounded without any DB token lookups.
 */
export const twoFactorChallengeIpRateLimit = createRateLimit({
  action: 'auth.2fa-challenge.ip',
  max: 30,
  window: '15m',
});

/**
 * Per-user limit for the 2FA challenge endpoint, checked AFTER the challenge
 * cookie resolves to a user. No `globalMax` — the IP bound is enforced by
 * `twoFactorChallengeIpRateLimit` above.
 */
export const twoFactorChallengeUserRateLimit = createRateLimit({
  action: 'auth.2fa-challenge.user',
  max: 10,
  window: '15m',
});

export const linkOrgAccountRateLimit = createRateLimit({
  action: 'auth.link-org-account',
  max: 5,
  globalMax: 20,
  window: '1h',
});

export const reportSenderRateLimit = createRateLimit({
  action: 'recipient.report-sender',
  max: 1,
  window: '7d',
});

// ---- Billing ----

export const syncSubscriptionRateLimit = createRateLimit({
  action: 'billing.sync-subscription',
  max: 10,
  window: '15m',
});

// ---- API (Tier 4 - Standard) ----

export const apiV1RateLimit = createRateLimit({
  action: 'api.v1',
  max: 1000,
  window: '1m',
});

export const apiV2RateLimit = createRateLimit({
  action: 'api.v2',
  max: 1000,
  window: '1m',
});

export const apiTrpcRateLimit = createRateLimit({
  action: 'api.trpc',
  max: 100,
  window: '1m',
});

export const aiRateLimit = createRateLimit({
  action: 'api.ai',
  max: 3,
  window: '1m',
});

export const fileUploadRateLimit = createRateLimit({
  action: 'api.file-upload',
  max: 20,
  window: '1m',
});
