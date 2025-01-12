import { type Page, expect, test } from '@playwright/test';

import {
  extractUserVerificationToken,
  seedTestEmail,
  seedUser,
} from '@documenso/prisma/seed/users';

test.use({ storageState: { cookies: [], origins: [] } });

test('[USER] can sign up with email and password', async ({ page }: { page: Page }) => {
  const username = 'Test User';
  const email = seedTestEmail();
  const password = 'Password123#';

  await page.goto('/signup');
  await page.getByLabel('Name').fill(username);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2);
    await page.mouse.up();
  }

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Public profile username').fill(Date.now().toString());

  await page.getByRole('button', { name: 'Complete', exact: true }).click();

  await page.waitForURL('/unverified-account');

  const { token } = await extractUserVerificationToken(email);

  await page.goto(`/verify-email/${token}`);

  await expect(page.getByRole('heading')).toContainText('Email Confirmed!');

  // We now automatically redirect to the home page
  // await page.getByRole('link', { name: 'Go back home' }).click();

  await page.waitForURL('/documents');

  await expect(page).toHaveURL('/documents');
});

test('[USER] can sign in using email and password', async ({ page }: { page: Page }) => {
  const user = await seedUser();

  await page.goto('/signin');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('/documents');
  await expect(page).toHaveURL('/documents');
});
