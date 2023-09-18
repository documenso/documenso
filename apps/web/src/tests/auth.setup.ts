import { type Page, expect, test as setup } from '@playwright/test';

import { STORAGE_STATE } from '../../../../playwright.config';

setup('authenticate', async ({ page }: { page: Page }) => {
  await page.goto('/signup');
  await page.getByLabel('Name').fill(process.env.E2E_TEST_USERNAME);
  await page.getByLabel('Email').fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel('Password').fill(process.env.E2E_TEST_USER_PASSWORD);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();

  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
    await page.mouse.up();
  }

  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.waitForURL('/documents');
  await expect(page).toHaveURL('/documents');
  await page.context().storageState({ path: STORAGE_STATE });
});
