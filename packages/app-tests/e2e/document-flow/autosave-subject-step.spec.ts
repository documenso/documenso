import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel', timeout: 60000 });

export const setupDocumentAndNavigateToSubjectStep = async (page: Page) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');

  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();

  return { user, document };
};

export const triggerAutosave = async (page: Page) => {
  await page.getByText('Signature').click();
  /*
   * Auto-saving has a delay of 2000ms and added 1000ms extra to avoid timeouts in tests
   */
  await page.waitForTimeout(3000);
};

test.describe('AutoSave Subject Step', () => {
  test('should autosave the subject field', async ({ page }) => {
    const { user, document } = await setupDocumentAndNavigateToSubjectStep(page);

    const subject = 'Hello world!';

    await page.getByRole('textbox', { name: 'Subject (Optional)' }).fill(subject);

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    await expect(page.getByRole('textbox', { name: 'Subject (Optional)' })).toHaveValue(
      documentDataFromDB.documentMeta?.subject ?? '',
    );
  });

  test('should autosave the message field', async ({ page }) => {
    const { user, document } = await setupDocumentAndNavigateToSubjectStep(page);

    const message = 'Please review and sign this important document. Thank you!';

    await page.getByRole('textbox', { name: 'Message (Optional)' }).fill(message);

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    await expect(page.getByRole('textbox', { name: 'Message (Optional)' })).toHaveValue(
      documentDataFromDB.documentMeta?.message ?? '',
    );
  });

  test('should autosave the email settings checkboxes', async ({ page }) => {
    const { user, document } = await setupDocumentAndNavigateToSubjectStep(page);

    // Toggle some email settings checkboxes (randomly - some checked, some unchecked)
    await page.getByText('Send recipient signed email').click();
    await page.getByText('Send recipient removed email').click();
    await page.getByText('Send document completed email', { exact: true }).click();
    await page.getByText('Send document deleted email').click();

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    const emailSettings = documentDataFromDB.documentMeta?.emailSettings;

    await expect(page.getByText('Send recipient signed email')).toBeChecked({
      checked: emailSettings?.recipientSigned,
    });
    await expect(page.getByText('Send recipient removed email')).toBeChecked({
      checked: emailSettings?.recipientRemoved,
    });
    await expect(page.getByText('Send document completed email', { exact: true })).toBeChecked({
      checked: emailSettings?.documentCompleted,
    });
    await expect(page.getByText('Send document deleted email')).toBeChecked({
      checked: emailSettings?.documentDeleted,
    });

    await expect(page.getByText('Send recipient signing request email')).toBeChecked({
      checked: emailSettings?.recipientSigningRequest,
    });
    await expect(page.getByText('Send document pending email')).toBeChecked({
      checked: emailSettings?.documentPending,
    });
    await expect(page.getByText('Send document completed email to the owner')).toBeChecked({
      checked: emailSettings?.ownerDocumentCompleted,
    });
  });

  test('should autosave all fields and settings together', async ({ page }) => {
    const { user, document } = await setupDocumentAndNavigateToSubjectStep(page);

    const subject = 'Combined Test Subject - Please Sign';
    const message =
      'This is a comprehensive test message for autosave functionality. Please review and sign at your earliest convenience.';

    await page.getByRole('textbox', { name: 'Subject (Optional)' }).fill(subject);
    await page.getByRole('textbox', { name: 'Message (Optional)' }).fill(message);

    await page.getByText('Send recipient signed email').click();
    await page.getByText('Send recipient removed email').click();
    await page.getByText('Send document completed email', { exact: true }).click();
    await page.getByText('Send document deleted email').click();

    await triggerAutosave(page);

    const documentDataFromDB = await getDocumentById({
      documentId: document.id,
      userId: user.id,
    });

    expect(documentDataFromDB.documentMeta?.subject).toBe(subject);
    expect(documentDataFromDB.documentMeta?.message).toBe(message);
    expect(documentDataFromDB.documentMeta?.emailSettings).toBeDefined();

    await expect(page.getByRole('textbox', { name: 'Subject (Optional)' })).toHaveValue(
      documentDataFromDB.documentMeta?.subject ?? '',
    );
    await expect(page.getByRole('textbox', { name: 'Message (Optional)' })).toHaveValue(
      documentDataFromDB.documentMeta?.message ?? '',
    );

    await expect(page.getByText('Send recipient signed email')).toBeChecked({
      checked: documentDataFromDB.documentMeta?.emailSettings?.recipientSigned,
    });
    await expect(page.getByText('Send recipient removed email')).toBeChecked({
      checked: documentDataFromDB.documentMeta?.emailSettings?.recipientRemoved,
    });
    await expect(page.getByText('Send document completed email', { exact: true })).toBeChecked({
      checked: documentDataFromDB.documentMeta?.emailSettings?.documentCompleted,
    });
    await expect(page.getByText('Send document deleted email')).toBeChecked({
      checked: documentDataFromDB.documentMeta?.emailSettings?.documentDeleted,
    });

    await expect(page.getByText('Send recipient signing request email')).toBeChecked({
      checked: documentDataFromDB.documentMeta?.emailSettings?.recipientSigningRequest,
    });
    await expect(page.getByText('Send document pending email')).toBeChecked({
      checked: documentDataFromDB.documentMeta?.emailSettings?.documentPending,
    });
    await expect(page.getByText('Send document completed email to the owner')).toBeChecked({
      checked: documentDataFromDB.documentMeta?.emailSettings?.ownerDocumentCompleted,
    });
  });
});
