import { type Page, expect, test as setup } from '@playwright/test';

import { STORAGE_STATE } from '../../../playwright.config';

const username = process.env.E2E_TEST_AUTHENTICATE_USERNAME || '';
const email = process.env.E2E_TEST_AUTHENTICATE_USER_EMAIL || '';
const password = process.env.E2E_TEST_AUTHENTICATE_USER_PASSWORD || '';

setup('authenticate', async ({ page }: { page: Page }) => {
  await page.goto('/signup');
  await page.getByLabel('Name').fill(username);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();

  if (box) {
    await page.mouse.move(box.x + box.width / 8, box.y + box.height / 6);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 8, box.y + box.height / 6);
    await page.mouse.up();
  }

  await page.getByRole('button', { name: 'Sign Up' }).click();

  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('/documents');
  await expect(page).toHaveURL('/documents');
  await page.context().storageState({ path: STORAGE_STATE });
});
