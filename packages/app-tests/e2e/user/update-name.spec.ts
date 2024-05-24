import { expect, test } from '@playwright/test';

import { getUserByEmail } from '@documenso/lib/server-only/user/get-user-by-email';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test('[USER] update full name', async ({ page }) => {
  const user = await seedUser();

  await apiSignin({ page, email: user.email, redirectPath: '/settings/profile' });

  await page.getByLabel('Full Name').fill('John Doe');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();

  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
    await page.mouse.up();
  }

  await page.getByRole('button', { name: 'Update profile' }).click();

  // wait for it to finish
  await expect(page.getByText('Profile updated', { exact: true })).toBeVisible();

  await page.waitForURL('/settings/profile');

  expect((await getUserByEmail({ email: user.email })).name).toEqual('John Doe');
});
