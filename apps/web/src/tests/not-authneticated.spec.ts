import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('sign up with email and password', async ({ page }) => {
  await page.goto('http://localhost:3000/signup');
  await page.getByLabel('Name').fill('John Doe');
  await page.getByLabel('Email').fill('johndoee@documenso.com');
  await page.getByLabel('Password').fill('my_secure_password');

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

test('user can login with user and password', async ({ page }) => {
  await page.goto('http://localhost:3000/signin');
  await page.getByLabel('Email').fill('johndoee@documenso.com');
  await page.getByLabel('Password').fill('my_secure_passwords');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL('http://localhost:3000/documents');
});
