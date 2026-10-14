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
import { waitForHydration } from '../fixtures/hydration';

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

test('[USER] password update requires a 2FA code when 2FA is enabled', async ({ page }) => {
  const oldPassword = 'password';
  const newPassword = 'Test123!';

  const { user } = await seedUser({ password: oldPassword });

  // Sign in before enabling 2FA since apiSignin does not send a code.
  await apiSignin({ page, email: user.email, password: oldPassword, redirectPath: '/settings/profile' });

  await setupTwoFactorAuthentication({ user });

  const userWithSecret = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  await enableTwoFactorAuthentication({ user: userWithSecret, code: await getCurrentTotpCode(user.id) });

  await page.goto('/settings/security');
  await waitForHydration(page, 'input[name="currentPassword"]');

  await page.getByLabel('Current password').fill(oldPassword);
  await page.getByLabel('New password').fill(newPassword);
  await page.getByLabel('Repeat password').fill(newPassword);
  await page.getByRole('button', { name: 'Update password' }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByText('Two-Factor Authentication')).toBeVisible();

  // Empty code is caught client-side.
  await dialog.getByRole('button', { name: 'Update password' }).click();
  await expect(dialog.getByText('A code is required')).toBeVisible();

  const codeInput = dialog.locator('input').first();

  // Wrong code is rejected server-side and the dialog stays open.
  await codeInput.fill('000000');
  await dialog.getByRole('button', { name: 'Update password' }).click();
  await expect(page.locator('body')).toContainText('The two factor code you provided is invalid');
  await expect(dialog).toBeVisible();

  // Correct code updates the password.
  await codeInput.fill('');
  await codeInput.fill(await getCurrentTotpCode(user.id));
  await dialog.getByRole('button', { name: 'Update password' }).click();
  await expect(page.locator('body')).toContainText('Password updated');
  await expect(dialog).not.toBeVisible();

  const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  expect(updatedUser.password).not.toBe(userWithSecret.password);
});

test('[USER] password update API rejects a missing 2FA code when 2FA is enabled', async ({ page }) => {
  const { user } = await seedUser();

  await apiSignin({ page, email: user.email, redirectPath: '/settings/profile' });

  await setupTwoFactorAuthentication({ user });

  const userWithSecret = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  await enableTwoFactorAuthentication({ user: userWithSecret, code: await getCurrentTotpCode(user.id) });

  const response = await page.request.post('/api/auth/email-password/update-password', {
    data: { currentPassword: 'password', password: 'Test123!' },
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ code: 'TWO_FACTOR_MISSING_CREDENTIALS' });

  const unchangedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  expect(unchangedUser.password).toBe(userWithSecret.password);
});
