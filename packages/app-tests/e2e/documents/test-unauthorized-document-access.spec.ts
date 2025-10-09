import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import {
  seedBlankDocument,
  seedCompletedDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({
  mode: 'parallel',
});

test.describe('Unauthorized Access to Documents', () => {
  test('should block unauthorized access to the draft document page', async ({ page }) => {
    const { user, team } = await seedUser();
    const document = await seedBlankDocument(user, team.id);

    const { user: unauthorizedUser } = await seedUser();

    await apiSignin({
      page,
      email: unauthorizedUser.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/documents/${document.id}`);
    await expect(page.getByRole('heading', { name: 'Team not found' })).toBeVisible();
  });

  test('should block unauthorized access to the draft document edit page', async ({ page }) => {
    const { user, team } = await seedUser();
    const document = await seedBlankDocument(user, team.id);

    const { user: unauthorizedUser } = await seedUser();

    await apiSignin({
      page,
      email: unauthorizedUser.email,
      redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
    });

    await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/documents/${document.id}/edit`);
    await expect(page.getByRole('heading', { name: 'Team not found' })).toBeVisible();
  });

  test('should block unauthorized access to the pending document page', async ({ page }) => {
    const { user, team } = await seedUser();
    const { user: recipient } = await seedUser();
    const document = await seedPendingDocument(user, team.id, [recipient]);

    const { user: unauthorizedUser } = await seedUser();

    await apiSignin({
      page,
      email: unauthorizedUser.email,
      redirectPath: `/t/${team.url}/documents/${document.id}`,
    });

    await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/documents/${document.id}`);
    await expect(page.getByRole('heading', { name: 'Team not found' })).toBeVisible();
  });

  test('should block unauthorized access to pending document edit page', async ({ page }) => {
    const { user, team } = await seedUser();
    const { user: recipient } = await seedUser();
    const document = await seedPendingDocument(user, team.id, [recipient]);

    const { user: unauthorizedUser } = await seedUser();

    await apiSignin({
      page,
      email: unauthorizedUser.email,
      redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
    });

    await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/documents/${document.id}/edit`);
    await expect(page.getByRole('heading', { name: 'Team not found' })).toBeVisible();
  });

  test('should block unauthorized access to completed document page', async ({ page }) => {
    const { user, team } = await seedUser();
    const { user: recipient } = await seedUser();
    const document = await seedCompletedDocument(user, team.id, [recipient]);

    const { user: unauthorizedUser } = await seedUser();

    await apiSignin({
      page,
      email: unauthorizedUser.email,
      redirectPath: `/t/${team.url}/documents/${document.id}`,
    });

    await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/documents/${document.id}`);
    await expect(page.getByRole('heading', { name: 'Team not found' })).toBeVisible();
  });
});
