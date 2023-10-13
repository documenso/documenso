import { type Page, expect, test } from '@playwright/test';

import { deleteUser } from '@documenso/lib/server-only/user/delete-user';

test.use({ storageState: { cookies: [], origins: [] } });

/* 
  Using them sequentially so the 2nd test
  uses the details from the 1st (registration) test
*/
test.describe.configure({ mode: 'serial' });

const username = process.env.E2E_TEST_AUTHENTICATE_USERNAME;
const email = process.env.E2E_TEST_AUTHENTICATE_USER_EMAIL;
const password = process.env.E2E_TEST_AUTHENTICATE_USER_PASSWORD;

test('user can sign up with email and password', async ({ page }: { page: Page }) => {
  await page.goto('/signup');
  await page.getByLabel('Name').fill(username);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);

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
});

test('user can login with user and password', async ({ page }: { page: Page }) => {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('/documents');
  await expect(page).toHaveURL('/documents');
});

test.afterAll('Teardown', async () => {
  try {
    await deleteUser({ email });
  } catch (e) {
    throw new Error(`Error deleting user: ${e}`);
  }
});
