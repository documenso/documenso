import { type Page, expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('user can sign up with email and password', async ({ page }: { page: Page }) => {
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
});

test('user can login with user and password', async ({ page }: { page: Page }) => {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel('Password').fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL('/documents');
});
