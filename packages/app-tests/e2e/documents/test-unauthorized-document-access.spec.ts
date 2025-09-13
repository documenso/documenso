import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
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

    await page.goto(
      `${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}`,
    );
    await expect(page.getByRole('heading', { name: 'Oops! Something went wrong.' })).toBeVisible();
  });

  test('should block unauthorized access to the draft document edit page', async ({ page }) => {
    const { user, team } = await seedUser();
    const document = await seedBlankDocument(user, team.id);

    const { user: unauthorizedUser } = await seedUser();

    await apiSignin({
      page,
      email: unauthorizedUser.email,
      redirectPath: `/t/${team.url}/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/edit`,
    });

    await page.goto(
      `${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/edit`,
    );
    await expect(page.getByRole('heading', { name: 'Oops! Something went wrong.' })).toBeVisible();
  });

  test('should block unauthorized access to the pending document page', async ({ page }) => {
    const { user, team } = await seedUser();
    const { user: recipient } = await seedUser();
    const document = await seedPendingDocument(user, team.id, [recipient]);

    const { user: unauthorizedUser } = await seedUser();

    await apiSignin({
      page,
      email: unauthorizedUser.email,
      redirectPath: `/t/${team.url}/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}`,
    });

    await page.goto(
      `${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}`,
    );
    await expect(page.getByRole('heading', { name: 'Oops! Something went wrong.' })).toBeVisible();
  });

  test('should block unauthorized access to pending document edit page', async ({ page }) => {
    const { user, team } = await seedUser();
    const { user: recipient } = await seedUser();
    const document = await seedPendingDocument(user, team.id, [recipient]);

    const { user: unauthorizedUser } = await seedUser();

    await apiSignin({
      page,
      email: unauthorizedUser.email,
      redirectPath: `/t/${team.url}/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/edit`,
    });

    await page.goto(
      `${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}/edit`,
    );
    await expect(page.getByRole('heading', { name: 'Oops! Something went wrong.' })).toBeVisible();
  });

  test('should block unauthorized access to completed document page', async ({ page }) => {
    const { user, team } = await seedUser();
    const { user: recipient } = await seedUser();
    const document = await seedCompletedDocument(user, team.id, [recipient]);

    const { user: unauthorizedUser } = await seedUser();

    await apiSignin({
      page,
      email: unauthorizedUser.email,
      redirectPath: `/t/${team.url}/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}`,
    });

    await page.goto(
      `${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/documents/${mapSecondaryIdToDocumentId(document.secondaryId)}`,
    );
    await expect(page.getByRole('heading', { name: 'Oops! Something went wrong.' })).toBeVisible();
  });
});
