import { expect, test } from '@playwright/test';

import {
  seedBlankDocument,
  seedDraftDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test('[DOCUMENT_FLOW]: add settings', async ({ page }) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
  });

  // Set title.
  await page.getByLabel('Title').fill('New Title');

  // Set access auth.
  await page.getByTestId('documentAccessSelectValue').click();
  await page.getByRole('option').filter({ hasText: 'Require account' }).click();
  await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');

  // Action auth should NOT be visible.
  await expect(page.getByTestId('documentActionSelectValue')).not.toBeVisible();

  // Save the settings by going to the next step.

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  // Return to the settings step to check that the results are saved correctly.
  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  await expect(page.getByLabel('Title')).toHaveValue('New Title');
  await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');
});

test('[DOCUMENT_FLOW]: title should be disabled depending on document status', async ({ page }) => {
  const { user, team } = await seedUser();

  const pendingDocument = await seedPendingDocument(user, team.id, []);
  const draftDocument = await seedDraftDocument(user, team.id, []);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${pendingDocument.id}/edit`,
  });

  // Should be disabled for pending documents.
  await expect(page.getByLabel('Title')).toBeDisabled();

  // Should be enabled for draft documents.
  await page.goto(`/t/${team.url}/documents/${draftDocument.id}/edit`);
  await expect(page.getByLabel('Title')).toBeEnabled();
});
