import { type Page, expect, test } from '@playwright/test';

import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../fixtures/authentication';

test.use({ storageState: { cookies: [], origins: [] } });

test('[USER] can reset password via forgot password', async ({ page }: { page: Page }) => {
  const oldPassword = 'Test123!';
  const newPassword = 'Test124!';

  const user = await seedUser({
    password: oldPassword,
  });

  await page.goto('http://localhost:3000/signin');
  await page.getByRole('link', { name: 'Forgot your password?' }).click();

  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(user.email);

  await expect(page.getByRole('button', { name: 'Reset Password' })).toBeEnabled();
  await page.getByRole('button', { name: 'Reset Password' }).click();

  await expect(page.locator('body')).toContainText('Reset email sent', { timeout: 10000 });

  const foundToken = await prisma.passwordResetToken.findFirstOrThrow({
    where: {
      userId: user.id,
    },
    include: {
      user: true,
    },
  });

  await page.goto(`http://localhost:3000/reset-password/${foundToken.token}`);

  // Assert that password cannot be same as old password.
  await page.getByLabel('Password', { exact: true }).fill(oldPassword);
  await page.getByLabel('Repeat Password').fill(oldPassword);

  // Ensure both fields are filled before clicking
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue(oldPassword);
  await expect(page.getByLabel('Repeat Password')).toHaveValue(oldPassword);

  await page.getByRole('button', { name: 'Reset Password' }).click();
  await expect(page.locator('body')).toContainText(
    'Your new password cannot be the same as your old password.',
  );

  // Assert password reset.
  await page.getByLabel('Password', { exact: true }).fill(newPassword);
  await page.getByLabel('Repeat Password').fill(newPassword);

  // Ensure both fields are filled before clicking
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue(newPassword);
  await expect(page.getByLabel('Repeat Password')).toHaveValue(newPassword);

  await page.getByRole('button', { name: 'Reset Password' }).click();
  await expect(page.locator('body')).toContainText('Your password has been updated successfully.');

  // Assert sign in works.
  await apiSignin({
    page,
    email: user.email,
    password: newPassword,
  });

  await page.waitForURL('/documents');
  await expect(page).toHaveURL('/documents');
});

test('[USER] can reset password via user settings', async ({ page }: { page: Page }) => {
  const oldPassword = 'Test123!';
  const newPassword = 'Test124!';

  const user = await seedUser({
    password: oldPassword,
  });

  await apiSignin({
    page,
    email: user.email,
    password: oldPassword,
    redirectPath: '/settings/security',
  });

  await page.getByLabel('Current password').fill(oldPassword);
  await page.getByLabel('New password').fill(newPassword);
  await page.getByLabel('Repeat password').fill(newPassword);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.locator('body')).toContainText('Password updated');

  await apiSignout({
    page,
  });

  // Assert sign in works.
  await apiSignin({
    page,
    email: user.email,
    password: newPassword,
  });

  await page.waitForURL('/documents');
  await expect(page).toHaveURL('/documents');
});
