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

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Two-Factor Authentication')).toBeVisible();

  await dialog.getByRole('button', { name: 'Use Backup Code' }).click();
  await dialog.getByLabel('Backup Code').fill(backupCodes[0]);
  await dialog.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL(/\/onboarding\/2fa/);

  await expect(page.getByRole('heading', { name: 'Two-factor authentication' })).toBeVisible();

  await expect(page.getByRole('link', { name: 'Skip for now' })).toBeVisible();

  expect(await checkSessionValid(page)).toBe(true);

  const updatedUser = await prisma.user.findFirstOrThrow({
    where: {
      id: user.id,
    },
  });

  expect(updatedUser.twoFactorEnabled).toBe(false);
  expect(updatedUser.twoFactorSecret).toBeNull();
  expect(updatedUser.twoFactorBackupCodes).toBeNull();

  const auditLog = await prisma.userSecurityAuditLog.findFirst({
    where: {
      userId: user.id,
      type: UserSecurityAuditLogType.AUTH_2FA_DISABLE,
    },
  });

  expect(auditLog).not.toBeNull();
});
