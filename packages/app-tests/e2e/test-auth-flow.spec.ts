import { type Page, expect, test } from '@playwright/test';

import {
  extractUserVerificationToken,
  seedUser,
  unseedUser,
  unseedUserByEmail,
} from '@documenso/prisma/seed/users';

test.use({ storageState: { cookies: [], origins: [] } });

test('user can sign up with email and password', async ({ page }: { page: Page }) => {
  const username = 'Test User';
  const email = `test-user-${Date.now()}@auth-flow.documenso.com`;
  const password = 'Password123#';

  await page.goto('/signup');
  await page.getByLabel('Name').fill(username);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();

  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
    await page.mouse.up();
  }

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Public profile username').fill('username-123');

  await page.getByRole('button', { name: 'Complete', exact: true }).click();

  await page.waitForURL('/unverified-account');

  const { token } = await extractUserVerificationToken(email);

  await page.goto(`/verify-email/${token}`);

  await expect(page.getByRole('heading')).toContainText('Email Confirmed!');

  await page.getByRole('link', { name: 'Go back home' }).click();

  await page.waitForURL('/documents');

  await expect(page).toHaveURL('/documents');
  await unseedUserByEmail(email);
});

test('user can login with user and password', async ({ page }: { page: Page }) => {
  const user = await seedUser();

  await page.goto('/signin');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('/documents');
  await expect(page).toHaveURL('/documents');

  await unseedUser(user.id);
});
