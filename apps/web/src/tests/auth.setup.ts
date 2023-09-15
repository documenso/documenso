import { type Page, expect, test as setup } from '@playwright/test';

import { STORAGE_STATE } from '../../../../playwright.config';

setup('authenticate', async ({ page }: { page: Page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel('Password').fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/documents');
  await expect(page).toHaveURL('/documents');
  await page.context().storageState({ path: STORAGE_STATE });
});
