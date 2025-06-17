import { type Page, expect, test } from '@playwright/test';

import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';
import { expectTextToBeVisible } from '../fixtures/generic';

test('[USER] revoke sessions', async ({ page }: { page: Page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    password: 'password',
    redirectPath: '/settings/security/sessions',
  });

  // Expect 2 rows length (header + 1)
  await expect(page.getByRole('row')).toHaveCount(2);

  // Clear cookies
  await page.context().clearCookies();

  await apiSignin({
    page,
    email: user.email,
    password: 'password',
    redirectPath: '/settings/security/sessions',
  });

  await page.context().clearCookies();

  await apiSignin({
    page,
    email: user.email,
    password: 'password',
    redirectPath: '/settings/security/sessions',
  });

  // Expect 4 (3 sessions + 1 header) rows length
  await expect(page.getByRole('row')).toHaveCount(4);

  // Revoke all sessions
  await page.getByRole('button', { name: 'Revoke all sessions' }).click();
  await page.getByRole('button', { name: 'Revoke all sessions' }).click();

  await expectTextToBeVisible(page, 'Sessions have been revoked');

  // Expect (1 sessions + 1 header) rows length
  await expect(page.getByRole('row')).toHaveCount(2);

  await page.context().clearCookies();

  await apiSignin({
    page,
    email: user.email,
    password: 'password',
    redirectPath: '/settings/security/sessions',
  });

  // Find table row which does not have text 'Current' and click the button called Revoke within the row.
  await page
    .getByRole('row')
    .filter({ hasNotText: 'Current' })
    .nth(1)
    .getByRole('button', { name: 'Revoke' })
    .click();
  await expectTextToBeVisible(page, 'Session revoked');

  // Expect (1 sessions + 1 header) rows length
  await expect(page.getByRole('row')).toHaveCount(2);

  // Revoke own session.
  await page
    .getByRole('row')
    .filter({ hasText: 'Current' })
    .first()
    .getByRole('button', { name: 'Revoke' })
    .click();

  await expect(page).toHaveURL('/signin');
});
