import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { UserSecurityAuditLogType } from '@prisma/client';

import { checkSessionValid } from '../fixtures/authentication';
import { seedUserTwoFactorAuthentication } from '../fixtures/two-factor';

test('[USER] backup code sign-in resets 2FA and lands on the re-enrolment page', async ({ page }) => {
  const { user } = await seedUser();

  const { backupCodes } = await seedUserTwoFactorAuthentication({ userId: user.id });

  await page.goto('/signin');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // The missing second factor opens the 2FA dialog.
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Two-Factor Authentication')).toBeVisible();

  await dialog.getByRole('button', { name: 'Use Backup Code' }).click();
  await dialog.getByLabel('Backup Code').fill(backupCodes[0]);
  await dialog.getByRole('button', { name: 'Sign In' }).click();

  // Backup codes are recovery, not sign-in: the server resets 2FA and the
  // client is redirected to the forced re-enrolment page.
  await page.waitForURL(/\/onboarding\/2fa/);

  await expect(page.getByRole('heading', { name: 'Two-factor authentication' })).toBeVisible();

  // Enforcement is not active for this user, so the page offers an explicit
  // skip link instead of auto-redirecting away.
  await expect(page.getByRole('link', { name: 'Skip for now' })).toBeVisible();

  // The recovery sign-in still authorizes a session.
  expect(await checkSessionValid(page)).toBe(true);

  // The reset is atomic: 2FA disabled, secret and backup codes cleared.
  const updatedUser = await prisma.user.findFirstOrThrow({
    where: {
      id: user.id,
    },
  });

  expect(updatedUser.twoFactorEnabled).toBe(false);
  expect(updatedUser.twoFactorSecret).toBeNull();
  expect(updatedUser.twoFactorBackupCodes).toBeNull();

  // The recovery reset is audit-logged.
  const auditLog = await prisma.userSecurityAuditLog.findFirst({
    where: {
      userId: user.id,
      type: UserSecurityAuditLogType.AUTH_2FA_DISABLE,
    },
  });

  expect(auditLog).not.toBeNull();

  // A consumed backup code cannot be used to sign in again: 2FA is no longer
  // enabled, so a plain password sign-in succeeds and re-enrolment starts
  // from scratch.
});
