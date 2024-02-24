import { expect, test } from '@playwright/test';

import { TEST_USERS } from '@documenso/prisma/seed/pr-713-add-document-search-to-command-menu';

test('[PR-713]: should see sent documents', async ({ page }) => {
  const [user] = TEST_USERS;

  await page.goto('/signin');

  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('/documents');

  await page.keyboard.press('Meta+K');

  await page.getByPlaceholder('Type a command or search...').first().fill('sent');
  await expect(page.getByRole('option', { name: '[713] Document - Sent' })).toBeVisible();
});

test('[PR-713]: should see received documents', async ({ page }) => {
  const [user] = TEST_USERS;

  await page.goto('/signin');

  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('/documents');

  await page.keyboard.press('Meta+K');

  await page.getByPlaceholder('Type a command or search...').first().fill('received');
  await expect(page.getByRole('option', { name: '[713] Document - Received' })).toBeVisible();
});

test('[PR-713]: should be able to search by recipient', async ({ page }) => {
  const [user, recipient] = TEST_USERS;

  await page.goto('/signin');

  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('/documents');

  await page.keyboard.press('Meta+K');

  await page.getByPlaceholder('Type a command or search...').first().fill(recipient.email);
  await expect(page.getByRole('option', { name: '[713] Document - Sent' })).toBeVisible();
});
