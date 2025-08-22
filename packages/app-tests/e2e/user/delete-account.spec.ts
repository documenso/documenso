import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getUserByEmail } from '@documenso/lib/server-only/user/get-user-by-email';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test('[USER] delete account', async ({ page }) => {
  const { user } = await seedUser();

  await apiSignin({ page, email: user.email, redirectPath: '/settings' });

  await page.getByRole('button', { name: 'Delete Account' }).click();
  await page.getByLabel('Confirm Email').fill(user.email);

  await expect(page.getByRole('button', { name: 'Confirm Deletion' })).not.toBeDisabled();
  await page.getByRole('button', { name: 'Confirm Deletion' }).click();

  await page.waitForURL(`${NEXT_PUBLIC_WEBAPP_URL()}/signin`);

  // Verify that the user no longer exists in the database
  await expect(getUserByEmail({ email: user.email })).rejects.toThrow();
});
