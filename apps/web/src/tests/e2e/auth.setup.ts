import { type Page, expect, test as setup } from '@playwright/test';

import { STORAGE_STATE } from '../../../../../playwright.config';

setup('authenticate', async ({ page }: { page: Page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('example@documenso.com');
  await page.getByLabel('Password').fill('123456');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/documents');
  await expect(page).toHaveURL('/documents');
  await page.context().storageState({ path: STORAGE_STATE });
});
