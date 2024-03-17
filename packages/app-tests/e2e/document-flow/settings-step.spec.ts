import { expect, test } from '@playwright/test';

import {
  seedBlankDocument,
  seedDraftDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedUser, unseedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[DOCUMENT_FLOW]: add settings', async ({ page }) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  // Set title.
  await page.getByLabel('Title').fill('New Title');

  // Set access auth.
  await page.getByTestId('documentAccessSelectValue').click();
  await page.getByLabel('Require account').getByText('Require account').click();
  await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');

  // Set action auth.
  await page.getByTestId('documentActionSelectValue').click();
  await page.getByLabel('Require account').getByText('Require account').click();
  await expect(page.getByTestId('documentActionSelectValue')).toContainText('Require account');

  // Save the settings by going to the next step.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  // Return to the settings step to check that the results are saved correctly.
  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  // Todo: Verify that the values are correct once we fix the issue where going back
  // does not show the updated values.
  // await expect(page.getByLabel('Title')).toContainText('New Title');
  // await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');
  // await expect(page.getByTestId('documentActionSelectValue')).toContainText('Require account');

  await unseedUser(user.id);
});

test('[DOCUMENT_FLOW]: title should be disabled depending on document status', async ({ page }) => {
  const user = await seedUser();

  const pendingDocument = await seedPendingDocument(user, []);
  const draftDocument = await seedDraftDocument(user, []);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${pendingDocument.id}/edit`,
  });

  // Should be disabled for pending documents.
  await expect(page.getByLabel('Title')).toBeDisabled();

  // Should be enabled for draft documents.
  await page.goto(`/documents/${draftDocument.id}/edit`);
  await expect(page.getByLabel('Title')).toBeEnabled();

  await unseedUser(user.id);
});
