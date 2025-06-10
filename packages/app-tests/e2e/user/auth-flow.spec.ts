import { type Page, expect, test } from '@playwright/test';

import { prisma } from '@documenso/prisma';
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

  await page.getByRole('button', { name: 'Complete', exact: true }).click();

  await page.waitForURL('/unverified-account');

  const { token } = await extractUserVerificationToken(email);

  const team = await prisma.team.findFirstOrThrow({
    where: {
      organisation: {
        members: {
          some: {
            user: {
              email,
            },
          },
        },
      },
    },
  });

  await page.goto(`/verify-email/${token}`);

  await expect(page.getByRole('heading')).toContainText('Email Confirmed!');

  // We now automatically redirect to the home page
  await page.getByRole('link', { name: 'Continue' }).click();

  // Expect to be redirected to their only team.
  await page.waitForURL(`/t/${team.url}/documents`);
  await expect(page).toHaveURL(`/t/${team.url}/documents`);
});

test('[USER] can sign in using email and password', async ({ page }: { page: Page }) => {
  const { user, team } = await seedUser();

  await page.goto('/signin');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL(`/t/${team.url}/documents`);
  await expect(page).toHaveURL(`/t/${team.url}/documents`);
});
