import { test } from '@playwright/test';

import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { seedUser } from '@documenso/prisma/seed/users';

import { manualLogin } from './fixtures/authentication';

test('delete user', async ({ page }) => {
  const user = await seedUser();

  await manualLogin({
    page,
    email: user.email,
    redirectPath: '/settings',
  });

  await page.getByTestId('delete-account-button').click();
  await page.getByTestId('delete-account-confirmation-button').click();

  await page.waitForURL(`${WEBAPP_BASE_URL}/signin`);
});
