// ABOUTME: API-level tests for POST /email-password/signup proving the password-signup
// ABOUTME: gate rejects account creation server-side before any user is created.

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import type { HonoAuthContext } from '../types/context';

const mockIsPasswordSignupDisabled = vi.fn();
const mockIsEmailDomainAllowedForSignup = vi.fn();
const mockCreateUser = vi.fn();
const mockTriggerJob = vi.fn();
const mockSignupRateLimitCheck = vi.fn();

vi.mock('@documenso/prisma', () => ({
  prisma: {},
}));

vi.mock('@documenso/lib/constants/auth', async (importOriginal) => ({
  ...(await importOriginal()),
  isPasswordSignupDisabled: mockIsPasswordSignupDisabled,
  isEmailDomainAllowedForSignup: mockIsEmailDomainAllowedForSignup,
}));

vi.mock('@documenso/lib/server-only/user/create-user', () => ({
  createUser: mockCreateUser,
}));

vi.mock('@documenso/lib/jobs/client', () => ({
  jobsClient: { triggerJob: mockTriggerJob },
}));

// The routes below are unrelated to /signup but live in the same Hono chain, so
// importing emailPasswordRoute pulls in their modules too. Stub them out since some
// transitively import email templates that need the Lingui macro transform, which
// isn't configured for this package's vitest run.
vi.mock('@documenso/lib/server-only/2fa/disable-2fa', () => ({ disableTwoFactorAuthentication: vi.fn() }));
vi.mock('@documenso/lib/server-only/2fa/enable-2fa', () => ({ enableTwoFactorAuthentication: vi.fn() }));
vi.mock('@documenso/lib/server-only/2fa/is-2fa-availble', () => ({ isTwoFactorAuthenticationEnabled: vi.fn() }));
vi.mock('@documenso/lib/server-only/2fa/setup-2fa', () => ({ setupTwoFactorAuthentication: vi.fn() }));
vi.mock('@documenso/lib/server-only/2fa/validate-2fa', () => ({ validateTwoFactorAuthentication: vi.fn() }));
vi.mock('@documenso/lib/server-only/2fa/view-backup-codes', () => ({ viewBackupCodes: vi.fn() }));
vi.mock('@documenso/lib/server-only/user/forgot-password', () => ({ forgotPassword: vi.fn() }));
vi.mock('@documenso/lib/server-only/user/get-most-recent-email-verification-token', () => ({
  getMostRecentEmailVerificationToken: vi.fn(),
}));
vi.mock('@documenso/lib/server-only/user/get-user-by-reset-token', () => ({ getUserByResetToken: vi.fn() }));
vi.mock('@documenso/lib/server-only/user/reset-password', () => ({ resetPassword: vi.fn() }));
vi.mock('@documenso/lib/server-only/user/verify-email', () => ({ verifyEmail: vi.fn() }));
vi.mock('@documenso/lib/server-only/user/update-password', () => ({ updatePassword: vi.fn() }));
vi.mock('@documenso/lib/server-only/user/service-accounts/deleted-account', () => ({
  deletedServiceAccountEmail: vi.fn().mockReturnValue('deleted@example.com'),
}));
vi.mock('@documenso/lib/server-only/user/service-accounts/legacy-service-account', () => ({
  legacyServiceAccountEmail: vi.fn().mockReturnValue('legacy@example.com'),
}));

vi.mock('@documenso/lib/server-only/rate-limit/rate-limits', () => ({
  forgotPasswordRateLimit: { check: vi.fn() },
  loginRateLimit: { check: vi.fn() },
  resendVerifyEmailRateLimit: { check: vi.fn() },
  resetPasswordRateLimit: { check: vi.fn() },
  signupRateLimit: { check: mockSignupRateLimitCheck },
  verifyEmailRateLimit: { check: vi.fn() },
}));

const validSignupPayload = {
  name: 'New Staffer',
  email: 'newstaffer@example.com',
  password: 'Password123!',
  signature: null,
};

/**
 * Mirrors the requestMetadata middleware and onError mapping that
 * packages/auth/server/index.ts applies around emailPasswordRoute, so the
 * route sees the same context contract and error responses it does in production.
 */
const buildTestApp = async () => {
  const { emailPasswordRoute } = await import('./email-password');

  const app = new Hono<HonoAuthContext>()
    .use(async (c, next) => {
      c.set('requestMetadata', { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      await next();
    })
    .route('/', emailPasswordRoute);

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ code: AppErrorCode.UNKNOWN_ERROR, message: err.message }, err.status);
    }

    if (err instanceof AppError) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const statusCode = (err.statusCode || 500) as ContentfulStatusCode;

      return c.json({ code: err.code, message: err.message }, statusCode);
    }

    return c.json({ code: AppErrorCode.UNKNOWN_ERROR, message: 'Internal Server Error' }, 500);
  });

  return app;
};

describe('POST /signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockIsEmailDomainAllowedForSignup.mockReturnValue(true);
    mockSignupRateLimitCheck.mockResolvedValue({
      isLimited: false,
      remaining: 10,
      limit: 10,
      reset: new Date(Date.now() + 1000),
    });
    mockCreateUser.mockResolvedValue({ id: 1, email: validSignupPayload.email });
    mockTriggerJob.mockResolvedValue(undefined);
  });

  it('rejects account creation when password signup is disabled', async () => {
    mockIsPasswordSignupDisabled.mockReturnValue(true);

    const app = await buildTestApp();

    const response = await app.request('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSignupPayload),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'SIGNUP_DISABLED' });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('creates the account when password signup is not disabled', async () => {
    mockIsPasswordSignupDisabled.mockReturnValue(false);

    const app = await buildTestApp();

    const response = await app.request('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSignupPayload),
    });

    expect(response.status).toBe(201);
    expect(mockCreateUser).toHaveBeenCalledTimes(1);
  });
});
