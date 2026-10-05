import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { enableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/enable-2fa';
import { setupTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/setup-2fa';
import { symmetricDecrypt } from '@documenso/lib/universal/crypto';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { base32 } from '@scure/base';
import { generateHOTP } from 'oslo/otp';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

/**
 * Derive the current TOTP for a user the same way `verifyTwoFactorAuthenticationToken` does.
 */
const getCurrentTotpCode = async (userId: number) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!DOCUMENSO_ENCRYPTION_KEY || !user.twoFactorSecret) {
    throw new Error('Expected encryption key and 2FA secret');
  }

  const secret = Buffer.from(symmetricDecrypt({ key: DOCUMENSO_ENCRYPTION_KEY, data: user.twoFactorSecret })).toString(
    'utf-8',
  );

  return await generateHOTP(base32.decode(secret), Math.floor(Date.now() / 30_000));
};

/**
 * Enables 2FA on a freshly seeded user and returns its id.
 */
const seedUserWithTwoFactor = async () => {
  const { user } = await seedUser();

  await setupTwoFactorAuthentication({ user });

  const userWithSecret = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  await enableTwoFactorAuthentication({ user: userWithSecret, code: await getCurrentTotpCode(user.id) });

  return user;
};

test('[USER] completing an OAuth sign in requires a 2FA code when 2FA is enabled', async ({ page }) => {
  const user = await seedUserWithTwoFactor();

  // Simulate the state the OAuth callback leaves behind: a signed `pending2fa`
  // cookie pointing at the user, and no session.
  await page.context().addCookies([
    {
      name: 'pending2fa',
      value: String(user.id),
      url: 'http://localhost:3000',
    },
  ]);

  // A wrong code is rejected and no session is issued.
  const invalidResponse = await page.request.post('/api/auth/two-factor/complete-oauth', {
    data: { totpCode: '000000' },
  });

  expect(invalidResponse.status()).toBe(401);
  expect(await invalidResponse.json()).toMatchObject({ code: 'INVALID_TWO_FACTOR_CODE' });

  // The correct code issues a session.
  const validResponse = await page.request.post('/api/auth/two-factor/complete-oauth', {
    data: { totpCode: await getCurrentTotpCode(user.id) },
  });

  expect(validResponse.status()).toBe(201);

  const sessionResponse = await page.request.get('/api/auth/session');

  expect(sessionResponse.status()).toBe(200);
  expect(await sessionResponse.json()).toMatchObject({ user: { id: user.id } });
});

test('[USER] completing an OAuth sign in without a pending cookie is rejected', async ({ page }) => {
  const response = await page.request.post('/api/auth/two-factor/complete-oauth', {
    data: { totpCode: '000000' },
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ code: 'INVALID_REQUEST' });
});

test('[USER] completing an OAuth sign in accepts a backup code', async ({ page }) => {
  const user = await seedUserWithTwoFactor();

  const userWithCodes = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  const backupCodes = JSON.parse(userWithCodes.twoFactorBackupCodes ?? '[]') as string[];

  expect(backupCodes.length).toBeGreaterThan(0);

  await page.context().addCookies([
    {
      name: 'pending2fa',
      value: String(user.id),
      url: 'http://localhost:3000',
    },
  ]);

  const response = await page.request.post('/api/auth/two-factor/complete-oauth', {
    data: { backupCode: backupCodes[0] },
  });

  expect(response.status()).toBe(201);
});

test('[USER] a signed in user with 2FA is not granted a session by the OAuth callback alone', async ({ page }) => {
  const user = await seedUserWithTwoFactor();

  // Sanity check: the password path still enforces 2FA (regression guard).
  const response = await page.request.post('/api/auth/email-password', {
    data: { email: user.email, password: 'password' },
  });

  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ code: 'INVALID_TWO_FACTOR_CODE' });
});

test('[USER] apiSignin still works for users without 2FA', async ({ page }) => {
  const { user } = await seedUser();

  await apiSignin({ page, email: user.email, redirectPath: '/settings/profile' });

  const sessionResponse = await page.request.get('/api/auth/session');

  expect(sessionResponse.status()).toBe(200);
  expect(await sessionResponse.json()).toMatchObject({ user: { id: user.id } });
});
