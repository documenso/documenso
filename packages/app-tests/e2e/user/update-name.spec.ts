import { expect, test } from '@playwright/test';

import { getUserByEmail } from '@documenso/lib/server-only/user/get-user-by-email';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { signSignaturePad } from '../fixtures/signature';

test('[USER] update full name', async ({ page }) => {
  const { user } = await seedUser();

  await apiSignin({ page, email: user.email, redirectPath: '/settings/profile' });

  await page.getByLabel('Full Name').fill('John Doe');

  await signSignaturePad(page);

  await page.getByRole('button', { name: 'Update profile' }).click();

  // wait for it to finish
  await expect(page.getByText('Profile updated', { exact: true })).toBeVisible();

  await page.waitForURL('/settings/profile');

  expect((await getUserByEmail({ email: user.email })).name).toEqual('John Doe');
});
