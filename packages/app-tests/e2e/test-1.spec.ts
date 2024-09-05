import { test } from '@playwright/test';

test('test', async ({ page }) => {
  await page.locator('body').click();
});
