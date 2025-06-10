import { type Page, expect, test } from '@playwright/test';

import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../fixtures/authentication';

test.use({ storageState: { cookies: [], origins: [] } });

test('[USER] can reset password via forgot password', async ({ page }: { page: Page }) => {
  const oldPassword = 'Test123!';
  const newPassword = 'Test124!';

  const { user } = await seedUser({
    password: oldPassword,
  });

  await page.goto('http://localhost:3000/signin');
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
  await page.getByRole('button', { name: 'Reset Password' }).click();
  await expect(page.locator('body')).toContainText('Reset email sent');

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
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(oldPassword);
  await page.getByRole('textbox', { name: 'Repeat Password' }).fill(oldPassword);
  await page.getByRole('button', { name: 'Reset Password' }).click();
  await expect(page.locator('body')).toContainText(
    'Your new password cannot be the same as your old password.',
  );

  // Assert password reset.
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(newPassword);
  await page.getByRole('textbox', { name: 'Repeat Password' }).fill(newPassword);
  await page.getByRole('button', { name: 'Reset Password' }).click();
  await expect(page.locator('body')).toContainText('Your password has been updated successfully.');

  // Assert sign in works.
  await apiSignin({
    page,
    email: user.email,
    password: newPassword,
    redirectPath: '/settings/profile',
  });

  await page.waitForURL('/settings/profile');
  await expect(page).toHaveURL('/settings/profile');
});

test('[USER] can reset password via user settings', async ({ page }: { page: Page }) => {
  const oldPassword = 'Test123!';
  const newPassword = 'Test124!';

  const { user } = await seedUser({
    password: oldPassword,
  });

  await apiSignin({
    page,
    email: user.email,
    password: oldPassword,
    redirectPath: '/settings/security',
  });

  await page.getByRole('textbox', { name: 'Current password' }).fill(oldPassword);
  await page.getByRole('textbox', { name: 'New password' }).fill(newPassword);
  await page.getByRole('textbox', { name: 'Repeat password' }).fill(newPassword);
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
    redirectPath: '/settings/profile',
  });

  await page.waitForURL('/settings/profile');
  await expect(page).toHaveURL('/settings/profile');
});
