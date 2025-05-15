import { type Page, expect, test } from '@playwright/test';

import {
  extractUserVerificationToken,
  seedTestEmail,
  seedUser,
} from '@documenso/prisma/seed/users';

import { signSignaturePad } from '../fixtures/signature';

test.use({ storageState: { cookies: [], origins: [] } });

test('[USER] can sign up with email and password', async ({ page }: { page: Page }) => {
  const username = 'Test User';
  const email = seedTestEmail();
  const password = 'Password123#';

  await page.goto('/signup');
  await page.getByLabel('Name').fill(username);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);

  await signSignaturePad(page);

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Public profile username').fill(Date.now().toString());

  await page.getByRole('button', { name: 'Complete', exact: true }).click();

  await page.waitForURL('/unverified-account');

  // Wait to ensure token is created in the database
  await page.waitForTimeout(2000);

  const { token } = await extractUserVerificationToken(email);

  await page.goto(`/verify-email/${token}`);

  await expect(page.getByRole('heading')).toContainText('Email Confirmed!');

  // We now automatically redirect to the home page
  await page.getByRole('link', { name: 'Continue' }).click();

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
